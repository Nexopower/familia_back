import { createCipheriv, scrypt, createDecipheriv } from 'crypto';
import { promisify } from 'util';
//esto es para que se encripte igual sin importar la pc no es segura
export class Encryption {
    private iv: Buffer;
    private key: Buffer;

    constructor() {}

    async initialize(password: string) {
        // Clave derivada de forma determinista
        this.key = (await promisify(scrypt)(password, 'salt', 32)) as Buffer;
        
        // IV fijo (32 caracteres = 16 bytes en hex)
        this.iv = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
    }

    async encryption(textToEncrypt: string): Promise<string> {
        if (!this.key || !this.iv) {
            throw new Error('Encryption not initialized.');
        }

        const cipher = createCipheriv('aes-256-ctr', this.key, this.iv);
        const encryptedText = Buffer.concat([
            cipher.update(textToEncrypt),
            cipher.final(),
        ]);

        const encryptedHex = encryptedText.toString('hex');
        return encryptedHex.slice(0, 100);
    }

    async decipher(encryptedHex: string): Promise<string> {
        if (!this.key || !this.iv) {
            throw new Error('Decryption not possible without key and iv.');
        }

        const encryptedText = Buffer.from(encryptedHex, 'hex');
        const decipher = createDecipheriv('aes-256-ctr', this.key, this.iv);
        const decryptedText = Buffer.concat([
            decipher.update(encryptedText),
            decipher.final(),
        ]);
        return decryptedText.toString();
    }
}

//opcion segura
/*

*/