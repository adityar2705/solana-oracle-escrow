use crate::state::*;
use crate::errors::*;
use std::str::FromStr;
use anchor_lang::prelude::*;
use switchboard_v2::AggregatorAccountData;
use anchor_lang::solana_program::clock::Clock;

//function to handle the withdraw of SOL if the price condition is met
pub fn withdraw_handler(ctx : Context<Withdraw>)->Result<()>{
    let feed = &ctx.accounts.feed_aggregator.load()?;
    let escrow_state = &ctx.accounts.escrow_account;

    //get the price feed result
    let val: f64 = feed.get_result()?.try_into()?;

    //check whther the feed has been updated in the last 300 seconds
    feed.check_staleness(Clock::get().unwrap().unix_timestamp, 300)
    .map_err(|_| error!(EscrowErrorCode::StaleFeed))?;

    msg!("Current feed result is {}!", val);
    msg!("Unlock price is {}", escrow_state.unlock_price);

    //return err if not reached the desired SOL price
    if val < escrow_state.unlock_price as f64{
        return Err(EscrowErrorCode::SolPriceAboveUnlockPrice.into())
    }   

    //transfer cannot be used here as the account also carries data -> ? if it fails we can safely handle it
    **escrow_state.to_account_info().try_borrow_mut_lamports()? = escrow_state
    .to_account_info()
    .lamports()
    .checked_sub(escrow_state.escrow_amount)
    .ok_or(ProgramError::InvalidArgument)?;

    //add the subtracted lamports to the user's account -> a little complicated but don't worry
    **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? = ctx.accounts.user
    .to_account_info()
    .lamports()
    .checked_add(escrow_state.escrow_amount)
    .ok_or(ProgramError::InvalidArgument)?;

    Ok(())
}

//struct for Withdraw instruction
#[derive(Accounts)]
pub struct Withdraw<'info>{
    #[account(mut)]
    pub user : Signer<'info>,

    //get the user's escrow account that they locked up SOL in using the seeds
    #[account(
        mut,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,

        //so that if withdraw completes we can close this account
        close = user 
    )]
    pub escrow_account : Account<'info,EscrowState>,

    //Switchboard SOL feed aggregator
    #[account(
        address = Pubkey::from_str(SOL_USDC_FEED).unwrap()
    )]

    //feed is fairly large -> so we use AccountLoaded -> since we can't take the whole data on our system
    pub feed_aggregator : AccountLoader<'info,AggregatorAccountData>,
    pub system_program : Program<'info,System>
}
