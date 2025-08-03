import * as nearAPI from "near-api-js";
import * as dotenv from "dotenv";
dotenv.config();

async function checkEscrowStatus(escrowId: number) {
  const near = await nearAPI.connect({
    networkId: process.env.NEAR_NETWORK!,
    nodeUrl: process.env.NEAR_RPC!,
  });
  
  try {
    const result = (await near.connection.provider.query({
      request_type: "call_function",
      finality: "final",
      account_id: process.env.ESCROW_NEAR_ACCOUNT_ID!,
      method_name: "get_escrow",
      args_base64: Buffer.from(JSON.stringify({ id: escrowId })).toString("base64"),
    })) as any;
    
    const escrow = JSON.parse(Buffer.from(result.result).toString());
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    
    console.log(`\n📋 Escrow ${escrowId} Status:`);
    console.log(`Sender: ${escrow.sender}`);
    console.log(`Token: ${escrow.token}`);
    console.log(`Amount: ${escrow.amount}`);
    console.log(`Hashlock: ${Buffer.from(escrow.hashlock).toString('hex')}`);
    console.log(`Resolver: ${escrow.resolver || 'None'}`);
    console.log(`Withdrawn: ${escrow.withdrawn}`);
    console.log(`\n⏰ Timing:`);
    console.log(`Current time: ${currentTime} (${new Date(currentTime * 1000).toISOString()})`);
    console.log(`Exclusive period ends: ${escrow.timelock_exclusive} (${new Date(escrow.timelock_exclusive * 1000).toISOString()})`);
    console.log(`Recovery period ends: ${escrow.timelock_recovery} (${new Date(escrow.timelock_recovery * 1000).toISOString()})`);
    
    if (currentTime < escrow.timelock_exclusive) {
      console.log(`\n🔒 Status: IN EXCLUSIVE PERIOD`);
      console.log(`Only the resolver (${escrow.resolver}) can withdraw.`);
      console.log(`Time until exclusive period ends: ${escrow.timelock_exclusive - currentTime} seconds`);
    } else if (currentTime < escrow.timelock_recovery) {
      console.log(`\n✅ Status: OPEN WITHDRAWAL PERIOD`);
      console.log(`Anyone can withdraw with the correct preimage.`);
    } else {
      console.log(`\n❌ Status: EXPIRED`);
      console.log(`Only the sender can refund.`);
    }
    
    console.log(`\n🔐 Environment accounts:`);
    console.log(`Resolver account in env: ${process.env.RESOLVER_NEAR_ACCOUNT_ID!}`);
    console.log(`User account in env: ${process.env.USER_NEAR_ACCOUNT_ID!}`);
    
  } catch (error: any) {
    console.error('Error fetching escrow:', error);
  }
}

// Check the escrow we just created
checkEscrowStatus(3).catch(console.error);
