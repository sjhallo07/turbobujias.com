# Security Specification - Autopartes Plus

## Data Invariants
- Users can only read and write their own profile, memory, and chat sessions.
- Admins (identified by the `admins` collection) have full access to inventory (`products`) and `partners`.
- Reviews are public for reading, but creating/updating is restricted to authenticated users for their own content.
- Audit logs are only writable by admins and readable by admins.
- Document IDs must be valid strings (size <= 128, alphanumeric).

## The Dirty Dozen Payloads (Targeting logic gaps)

1. **Identity Spoofing**: Attempt to create a user profile with a different UID.
2. **Privilege Escalation**: Non-admin attempting to write to `products`.
3. **State Poisoning**: Injecting 1MB string into a product name.
4. **Relational Break**: Creating a review for a non-existent product. (Hard to enforce without `get()`, but we check path).
5. **Session Hijacking**: User A attempting to read User B's chat sessions.
6. **Ghost Review**: Updating a review's `userId` after creation.
7. **Admin Impersonation**: Attempting to add self to `admins` collection.
8. **Memory Leak**: Reading another user's `UserMemory`.
9. **Audit Tampering**: Attempting to delete an `auditLog`.
10. **Shadow Field**: Adding `isAdmin: true` to a regular user profile.
11. **ID Poisoning**: Using a 2KB string as a product ID.
12. **Future Proofing**: Attempting to set `createdAt` to a future date manually (strictly use `request.time`).
