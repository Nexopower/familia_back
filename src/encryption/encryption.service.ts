import { Injectable } from '@nestjs/common';
import { Encryption } from 'src/class/encryption.class';

@Injectable()
export class EncryptionService {
  private readonly encryptionKey = 'familia_password_key_2025';

  /**
   * Hashea una contraseña usando la clase Encryption
   */
  async hashPassword(password: string): Promise<string> {
    const encryption = new Encryption();
    await encryption.initialize(this.encryptionKey);
    return await encryption.encryption(password);
  }

  /**
   * Compara una contraseña en texto plano con su hash
   * Cifra la contraseña y compara con el hash almacenado
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    const encryption = new Encryption();
    await encryption.initialize(this.encryptionKey);
    const encryptedPassword = await encryption.encryption(password);
    return encryptedPassword === hash;
  }
}
