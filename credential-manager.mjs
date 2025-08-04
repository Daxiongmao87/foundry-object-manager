#!/usr/bin/env node

/**
 * FoundryVTT Credential Manager
 * 
 * Securely stores and retrieves FoundryVTT authentication credentials
 * using AES-256-GCM encryption with machine-specific key derivation.
 */

import { createHash, randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { platform, hostname } from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class CredentialManager {
    constructor() {
        this.credentialFile = join(__dirname, '.foundry_credentials.json.enc');
        this.algorithm = 'aes-256-gcm';
        this.keyDerivationIterations = 100000;
    }

    /**
     * Generate a machine-specific encryption key
     * This creates a key unique to this machine and user
     */
    generateMachineKey() {
        // Use machine-specific identifiers to create a unique key
        const machineIdentifiers = [
            platform(),
            hostname(),
            process.env.USER || process.env.USERNAME || 'unknown',
            __dirname // Installation path as additional entropy
        ].join('|');

        // Derive key using PBKDF2 with machine identifiers as password
        const salt = createHash('sha256').update('foundry-credential-salt-v1').digest();
        return pbkdf2Sync(machineIdentifiers, salt, this.keyDerivationIterations, 32, 'sha256');
    }

    /**
     * Encrypt credentials data
     */
    encrypt(data) {
        const key = this.generateMachineKey();
        const iv = randomBytes(16);
        const cipher = createCipheriv(this.algorithm, key, iv);
        
        const jsonData = JSON.stringify(data);
        let encrypted = cipher.update(jsonData, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            version: 1
        };
    }

    /**
     * Decrypt credentials data
     */
    decrypt(encryptedData) {
        const key = this.generateMachineKey();
        const decipher = createDecipheriv(
            this.algorithm, 
            key, 
            Buffer.from(encryptedData.iv, 'hex')
        );
        
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return JSON.parse(decrypted);
    }

    /**
     * Save encrypted credentials to file
     */
    async saveCredentials(credentials) {
        try {
            const encryptedData = this.encrypt(credentials);
            writeFileSync(this.credentialFile, JSON.stringify(encryptedData, null, 2));
            
            // Set restrictive permissions (600 - owner read/write only)
            if (process.platform !== 'win32') {
                const fs = await import('fs');
                fs.chmodSync(this.credentialFile, 0o600);
            }
            
            return true;
        } catch (error) {
            throw new Error(`Failed to save credentials: ${error.message}`);
        }
    }

    /**
     * Load and decrypt credentials from file
     */
    loadCredentials() {
        try {
            if (!existsSync(this.credentialFile)) {
                return null;
            }
            
            const encryptedData = JSON.parse(readFileSync(this.credentialFile, 'utf8'));
            return this.decrypt(encryptedData);
        } catch (error) {
            throw new Error(`Failed to load credentials: ${error.message}`);
        }
    }

    /**
     * Store FoundryVTT admin password
     */
    async setAdminPassword(password) {
        const credentials = this.loadCredentials() || {};
        credentials.adminPassword = password;
        credentials.updatedAt = new Date().toISOString();
        
        await this.saveCredentials(credentials);
        console.log('✅ Admin password encrypted and saved successfully');
    }

    /**
     * Store FoundryVTT world password
     */
    async setWorldPassword(password) {
        const credentials = this.loadCredentials() || {};
        credentials.worldPassword = password;
        credentials.updatedAt = new Date().toISOString();
        
        await this.saveCredentials(credentials);
        console.log('✅ World password encrypted and saved successfully');
    }

    /**
     * Get admin password for authentication
     */
    getAdminPassword() {
        const credentials = this.loadCredentials();
        return credentials?.adminPassword || null;
    }

    /**
     * Get world password for authentication
     */
    getWorldPassword() {
        const credentials = this.loadCredentials();
        return credentials?.worldPassword || null;
    }

    /**
     * Get both passwords for authentication
     */
    getCredentials() {
        const credentials = this.loadCredentials();
        return {
            adminPassword: credentials?.adminPassword || null,
            worldPassword: credentials?.worldPassword || null,
            hasAdminPassword: !!(credentials?.adminPassword),
            hasWorldPassword: !!(credentials?.worldPassword),
            updatedAt: credentials?.updatedAt || null
        };
    }

    /**
     * Check if credentials file exists
     */
    hasCredentials() {
        return existsSync(this.credentialFile);
    }

    /**
     * Remove credentials file (for testing or reset)
     */
    async clearCredentials() {
        if (existsSync(this.credentialFile)) {
            const fs = await import('fs');
            fs.unlinkSync(this.credentialFile);
            console.log('✅ Credentials cleared successfully');
        } else {
            console.log('ℹ️  No credentials found to clear');
        }
    }

    /**
     * Display credential status (without revealing passwords)
     */
    showStatus() {
        const credentials = this.getCredentials();
        console.log('\n🔐 Credential Status:');
        console.log(`   Admin Password: ${credentials.hasAdminPassword ? '✅ Set' : '❌ Not Set'}`);
        console.log(`   World Password: ${credentials.hasWorldPassword ? '✅ Set' : '❌ Not Set'}`);
        if (credentials.updatedAt) {
            console.log(`   Last Updated: ${new Date(credentials.updatedAt).toLocaleString()}`);
        }
        console.log(`   Credential File: ${this.hasCredentials() ? '✅ Exists' : '❌ Missing'}`);
    }

    /**
     * Get credential status data (without revealing passwords)
     */
    getStatus() {
        const credentials = this.getCredentials();
        
        return {
            credentialFileExists: this.hasCredentials(),
            hasAdminPassword: credentials.hasAdminPassword,
            hasWorldPassword: credentials.hasWorldPassword,
            lastUpdated: credentials.updatedAt,
            credentialFile: this.credentialFile
        };
    }
}

export default CredentialManager;