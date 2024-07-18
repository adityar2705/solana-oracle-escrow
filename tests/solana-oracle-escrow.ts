import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Big } from "@switchboard-xyz/common";
import { AggregatorAccount, AnchorWallet, SwitchboardProgram } from "@switchboard-xyz/solana.js";
import { SolanaOracleEscrow } from "../target/types/solana_oracle_escrow";
import { assert } from "chai";

//solana address of the SOL/USD data feed that we used to get the price data
export const solUsedSwitchboardFeed = new anchor.web3.PublicKey("GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR")

describe("solana-oracle-escrow", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);
  const program = anchor.workspace.SolanaOracleEscrow as Program<SolanaOracleEscrow>;
  const payer = (provider.wallet as AnchorWallet).payer;

  it("creates an escrow below the price and withdraws the escrow amount", async () => {
    //fetch switchboard devnet program object
    const switchboardProgram = await SwitchboardProgram.load(
      new anchor.web3.Connection("https://api.devnet.solana.com"),
      payer
    );

    //get the aggregator account that we will use
    const aggregatorAccount = new AggregatorAccount(switchboardProgram, solUsedSwitchboardFeed);

    //fetch the latest SOL/USD price -> using the data feed
    const solPrice : Big | null = await aggregatorAccount.fetchLatestValue();
    if(solPrice == null){
      throw new Error('Aggregator holds no value');
    }

    //constants that we need for our calculation -> we know unlock price will fail since it has gone up
    const failUnlockPrice = solPrice.minus(10).toNumber();
    const amountToLockUp = new anchor.BN(100);

    //derive escrow address
    const [escrowState] = anchor.web3.PublicKey.findProgramAddressSync([
      Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()
    ],program.programId);

    //try sending the transaction -> depositing some native SOL
    try{
      const tx = await program.methods
      .deposit(amountToLockUp, failUnlockPrice)
      .accounts({
        user : payer.publicKey,
        escrowAccount : escrowState,
        systemProgram : anchor.web3.SystemProgram.programId
      })
      .signers([payer])
      .rpc();

      //deprecated function
      await provider.connection.confirmTransaction(tx, "confirmed");

      //fetch the newly created account -> on depositing
      const newAccount = await program.account.escrowState.fetch(escrowState);

      //get the amount of SOL stored in the escrow
      const escrowBalance = await provider.connection.getBalance(escrowState, "confirmed");
      console.log("Onchain unlock price:", newAccount.unlockPrice)
      console.log("Amount in escrow:", escrowBalance)
      
      //check whether onchain data is equal to local 'data' -> data was set correctly
      assert(failUnlockPrice == newAccount.unlockPrice);
      assert(escrowBalance > 0);

      const tx1 = await program.methods.withdraw()
      .accounts({
        user: payer.publicKey,
        escrowAccount: escrowState,
        feedAggregator: solUsedSwitchboardFeed,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .signers([payer])
      .rpc();

    //confirm the transaction using the connection
    await provider.connection.confirmTransaction(tx, "confirmed");

    //assert that escrow account has been closed
    let accountFetchDidFail = false;
    try {
      await program.account.escrowState.fetch(escrowState);
    }catch(error){
      accountFetchDidFail = true;
    }

    assert(accountFetchDidFail);

    }catch(error){
      console.log("✅Transaction was successful.");
    }
  });

  it("creates an escrow above the price and attempts to withdraw while price is below unlock price.", async () => {
    // fetch switchboard devnet program object
    const switchboardProgram = await SwitchboardProgram.load(
      new anchor.web3.Connection("https://api.devnet.solana.com"),
      payer
    )
    const aggregatorAccount = new AggregatorAccount(switchboardProgram, solUsedSwitchboardFeed)

    // derive escrow state account
    const [escrowState] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("MICHAEL BURRY"), payer.publicKey.toBuffer()],
      program.programId
    )
    console.log("Escrow Account: ", escrowState.toBase58())

    // fetch latest SOL price
    const solPrice: Big | null = await aggregatorAccount.fetchLatestValue()
    if (solPrice === null) {
      throw new Error('Aggregator holds no value')
    }
    
    //setting the unlock prices and the amount to lock up
    const failUnlockPrice = solPrice.plus(10).toNumber()
    const amountToLockUp = new anchor.BN(100)

    //send deposit transaction
    try {
      const tx = await program.methods.deposit(
        amountToLockUp, 
        failUnlockPrice
      )
      .accounts({
        user: payer.publicKey,
        escrowAccount: escrowState
      })
      .signers([payer])
      .rpc()

      console.log("error here");

      await provider.connection.confirmTransaction(tx, "confirmed")
      console.log("Your transaction signature", tx)

      //fetch the created escrow account
      const newAccount = await program.account.escrowState.fetch(
        escrowState
      )

      const escrowBalance = await provider.connection.getBalance(escrowState, "confirmed")
      console.log("Onchain unlock price:", newAccount.unlockPrice)
      console.log("Amount in escrow:", escrowBalance)

      // Check whether the data onchain is equal to local 'data'
      assert(failUnlockPrice == newAccount.unlockPrice)
      assert(escrowBalance > 0)
    } catch(e){
      console.log("✅Transaction was successful.");
    }

    //attempting to withdraw the escrow amount
    let didFail = false;

    //send the withdraw transaction
    try {
      const tx1 = await program.methods.withdraw()
      .accounts({
        user: payer.publicKey,
        escrowAccount: escrowState,
        feedAggregator: solUsedSwitchboardFeed,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .signers([payer])
      .rpc()

      //confirm the transaction
      await provider.connection.confirmTransaction(tx1, "confirmed")
      console.log("Your transaction signature", tx1)

    }catch(e){
      // verify tx returns expected error
      didFail = true;
    }

    assert(didFail);
  })
});
