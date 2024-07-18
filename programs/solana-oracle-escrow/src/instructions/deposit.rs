use crate::state::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{
    system_instruction::transfer,
    program::invoke
};

//function to deposit the native SOL
pub fn deposit_handler(ctx : Context<Deposit>, escrow_amt : u64, unlock_price : u64)->Result<()>{
    msg!("Depositing the funds in escrow.");
    let escrow_state = &mut ctx.accounts.escrow_account;

    //set the escrow amount and unlock price in the newly made PDA account
    escrow_state.escrow_amount = escrow_amt;
    escrow_state.unlock_price = unlock_price;

    //create the native SOL transfer instruction
    let transfer_ix = transfer(&ctx.accounts.user.key(), &escrow_state.key(), escrow_amt);

    //use CPI to invoke the transfer instruction
    invoke(&transfer_ix, &[
        ctx.accounts.user.to_account_info(),
        ctx.accounts.escrow_account.to_account_info(),
        ctx.accounts.system_program.to_account_info()
    ])?;

    msg!("Transfer complete. Escrow will unlock SOL at {}", &ctx.accounts.escrow_account.unlock_price);
    Ok(())
}

//building the struct for the deposit instruction
#[derive(Accounts)]
pub struct Deposit<'info>{
    #[account(mut)]
    pub user : Signer<'info>,
    #[account(
        init,
        seeds = [ESCROW_SEED, user.key().as_ref()],
        bump,
        payer = user,
        space = std::mem::size_of::<EscrowState>() + 8
    )]
    pub escrow_account : Account<'info,EscrowState>,
    pub system_program : Program<'info,System>,
}
