use anchor_lang::prelude::*;

//defining the seeds and getting SOL/USD data feed
pub const ESCROW_SEED :&[u8] = b"MICHAEL BURRY";
pub const SOL_USDC_FEED: &str = "GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR";

#[account]
pub struct EscrowState{
    pub unlock_price : u64,
    pub escrow_amount : u64
}