# STORY: Implement Secure Credential Store
## Description
Implement a secure mechanism for storing and retrieving the FoundryVTT admin password. This will prevent storing sensitive credentials in plain text and provide a safe way for the Puppeteer script to authenticate with the FoundryVTT server. The credentials should be stored in an encrypted local file.

### Acceptance Criteria
- [ ] A CLI command exists to set/update the admin password.
- [ ] The password is stored in an encrypted format on the local file system (e.g., in a `.foundry_credentials.json.enc` file).
- [ ] A secure method is available for other modules to retrieve the decrypted password for use at runtime.
- [ ] The credential file is added to `.gitignore`.

### Tasks
1. Choose a suitable Node.js encryption library (e.g., `crypto`).
2. Implement a `CredentialManager` class.
3. Add a method to encrypt and save the password to a file.
4. Add a method to decrypt and load the password from the file.
5. Implement a CLI command to allow the user to set their password.
6. Add the credential file path to `.gitignore`.
