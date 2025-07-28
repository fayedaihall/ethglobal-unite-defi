import hashlib
import base64

preimage = "mysecret"
hash_obj = hashlib.sha256(preimage.encode())
hash_bytes = hash_obj.digest()
hash_lock = base64.b64encode(hash_bytes).decode()
print(hash_lock)  # Should output: mZfua8h45DqNulVgrxZTMvokjWoud7E9h5uAxU25fkY=
