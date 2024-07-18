use anchor_lang::prelude::*;

//writing our oracle escrow error codes
#[error_code]
//this helps us to equate and compare any of our error codes
#[derive(Eq, PartialEq)]
pub enum EscrowErrorCode{
    #[msg("Not a valid Switchboard account")]
    InvalidSwitchboardAccount,

    #[msg("Switchboard feed has not been updated in 5 minutes")]
    StaleFeed,

    #[msg("Switchboard feed exceeded provided confidence interval")]
    ConfidenceIntervalExceeded,

    #[msg("Current SOL price is not above Escrow unlock price.")]
    SolPriceAboveUnlockPrice,
}
