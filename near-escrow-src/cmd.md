Step 1: Identify a Fungible Token Contract - 3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af
Step 2: Acquire Test USDC Tokens
Step 3: Call storage_deposit on the USDC Contract
Step 4: Test the Escrow Contract with USDC

Contract ID: 3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af (This is the official Circle-issued USDC contract on NEAR testnet. Note: It's a hex string format, which is valid for NEAR contracts, especially for native/bridged tokens like this.)
Metadata (You can verify this yourself with the command below):
Name: USD Coin
Symbol: USDC
Decimals: 6 (Important for amounts: 1 USDC = "1000000" in the smallest unit.)
near view 3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af ft_metadata

secret hash: e3f5f6c4a6d9b8e8f0d0c7a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c
[227, 245, 246, 196, 166, 217, 184, 232, 240, 208, 199, 165, 180, 195, 210, 225, 240, 169, 184, 199, 214, 229, 244, 163, 178, 193, 208, 233, 248, 167, 182, 108]
secret: mysecret (0x6d79736563726574)

near call 3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af storage_deposit '{"account_id": "escrowsrc.fayefaye.testnet"}' --accountId fayefaye.testnet --deposit 0.00125
near view 3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af storage_balance_of '{"account_id": "escrow.fayefaye.testnet"}'

near call 3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af ft_transfer_call '{"receiver_id": "escrowsrc.fayefaye.testnet", "amount": "1000000", "msg": "{\"lock_id\": \"test_lock\", \"secret_hash\": [227, 245, 246, 196, 166, 217, 184, 232, 240, 208, 199, 165, 180, 195, 210, 225, 240, 169, 184, 199, 214, 229, 244, 163, 178, 193, 208, 233, 248, 167, 182, 108], \"timelock\": 1756512000, \"amount\": \"1000000\", \"receiver_id\": \"receiver.testnet\"}"}' --accountId fayefaye.testnet --depositYocto 1 --gas 300000000000000
