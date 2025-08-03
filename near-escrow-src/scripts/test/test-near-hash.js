import crypto from "crypto";

// The secret we're using
const secretHex =
  "0ade51cf8eb73e918acb59e3abbbd8077eb4f7ab53d7e27168a2fb944569e0fc";
const expectedHashlock =
  "a62142a6d91226da2df913a6f992bf6490019d57c9ed1a4687ed8d29f95f15e9";

console.log("Testing NEAR contract hash calculation:");
console.log("Secret (hex):", secretHex);
console.log("Expected hashlock:", expectedHashlock);

// Convert hex to buffer
const secretBuffer = Buffer.from(secretHex, "hex");
console.log("Secret (buffer):", secretBuffer);

// Test different string representations
const testCases = [
  {
    name: "Hex string",
    value: secretHex,
    encoding: "utf8",
  },
  {
    name: "Binary string",
    value: String.fromCharCode(...secretBuffer),
    encoding: "binary",
  },
  {
    name: "Base64 string",
    value: secretBuffer.toString("base64"),
    encoding: "utf8",
  },
  {
    name: "Raw bytes as string (latin1)",
    value: secretBuffer.toString("latin1"),
    encoding: "latin1",
  },
];

for (const testCase of testCases) {
  console.log(`\n--- ${testCase.name} ---`);
  console.log("Value:", testCase.value);
  console.log("Value length:", testCase.value.length);

  // Simulate what NEAR contract does: preimage.as_bytes()
  const bytes = Buffer.from(testCase.value, testCase.encoding);
  console.log("As bytes:", bytes);

  // Calculate hash like NEAR contract: env::sha256(preimage.as_bytes())
  const hash = crypto.createHash("sha256").update(bytes).digest();
  const hashHex = hash.toString("hex");
  console.log("Hash:", hashHex);
  console.log("Matches expected:", hashHex === expectedHashlock);
}
