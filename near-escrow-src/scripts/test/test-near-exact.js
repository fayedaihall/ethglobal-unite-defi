import crypto from "crypto";

// Test with the new escrow data
const secretHex =
  "ccaf655946f83dc2f20642cc579778de84b76753bc8912ab1dbc190a7e72fd74";
const expectedHashlock =
  "5e547a5f71dcd10ff3b6b93e4339dd8ab0a3e73b9dd51f33a4802e4d9417ef14";

console.log("Testing exact NEAR contract behavior:");
console.log("Secret (hex):", secretHex);
console.log("Expected hashlock:", expectedHashlock);

// Convert hex to buffer
const secretBuffer = Buffer.from(secretHex, "hex");
console.log("Secret (buffer):", secretBuffer);

// Test different string representations that the NEAR contract might expect
const testCases = [
  {
    name: "Hex string",
    value: secretHex,
  },
  {
    name: "Binary string (fromCharCode)",
    value: String.fromCharCode(...secretBuffer),
  },
  {
    name: "Latin1 string",
    value: secretBuffer.toString("latin1"),
  },
  {
    name: "Base64 string",
    value: secretBuffer.toString("base64"),
  },
  {
    name: "Raw bytes as string (binary)",
    value: secretBuffer.toString("binary"),
  },
];

for (const testCase of testCases) {
  console.log(`\n--- ${testCase.name} ---`);
  console.log("Value:", testCase.value);
  console.log("Value length:", testCase.value.length);

  // Simulate exactly what NEAR contract does: preimage.as_bytes()
  const bytes = Buffer.from(testCase.value, "utf8");
  console.log("As bytes (utf8):", bytes);

  // Calculate hash like NEAR contract: env::sha256(preimage.as_bytes())
  const hash = crypto.createHash("sha256").update(bytes).digest();
  const hashHex = hash.toString("hex");
  console.log("Hash (utf8):", hashHex);
  console.log("Matches expected:", hashHex === expectedHashlock);

  // Also try with binary encoding
  const bytesBinary = Buffer.from(testCase.value, "binary");
  console.log("As bytes (binary):", bytesBinary);
  const hashBinary = crypto.createHash("sha256").update(bytesBinary).digest();
  const hashBinaryHex = hashBinary.toString("hex");
  console.log("Hash (binary):", hashBinaryHex);
  console.log("Matches expected (binary):", hashBinaryHex === expectedHashlock);
}
