use anchor_lang::prelude::*;
use instructions::deposit::*;
use instructions::withdraw::*;

pub mod instructions;
pub mod state;
pub mod errors;

declare_id!("9f1GpbHcewUBnp9tBQC8mEgRzMyyq5xKpLhwxnWYsZGw");

#[program]
pub mod solana_oracle_escrow {
    use super::*;

    //function that calls the deposit handler
    pub fn deposit(ctx: Context<Deposit>, escrow_amt : u64, unlock_price : u64) -> Result<()> {
        deposit_handler(ctx, escrow_amt, unlock_price)?;
        Ok(())
    }

    //function that calls the withdraw handler
    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()>{
        withdraw_handler(ctx)?;
        Ok(())
    }
}

