import { ethers } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

async function deployEthHTLC() {
  if (!process.env.ETH_RPC) {
    throw new Error("ETH_RPC env variable not set");
  }
  if (!process.env.ETH_PRIVATE_KEY) {
    throw new Error("ETH_PRIVATE_KEY env variable not set");
  }
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC);
  const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, provider);

  // 请将 "your_compiled_bytecode_here" 替换为实际的 solc 编译字节码
  const bytecode: string = "0x" + "your_compiled_bytecode_here";
  // 请将下面的 abi 替换为实际的 ABI 数组
  const abi: any[] = [
    /* your_compiled_ABI_array_here */
  ];

  const factory = new ethers.ContractFactory(abi, bytecode, wallet);
  const contract = await factory.deploy();
  const deploymentReceipt = await contract.deploymentTransaction()?.wait();
  console.log("HTLC deployed on Ethereum at:", contract.target);
  // For demo, log transaction hash
  const tx = contract.deploymentTransaction();
  if (tx) {
    console.log("Deployment tx:", tx.hash);
  } else {
    console.log("No deployment transaction found.");
  }
}

deployEthHTLC();
