export class usertoken {
  UserID: number;
  token: string;
  createdDate: Date;
  expiredDate: Date;
  expired: boolean;
  usercrea: number;
  usermod: number;
  fechcrea: Date;
  fechmod: Date;
  constructor() {
    this.UserID = 0;
    this.token = '';
    this.createdDate = new Date();
    this.expiredDate = new Date();
    this.expired = false;
    this.usercrea = 0;
    this.usermod = 0;
    this.fechcrea = new Date();
    this.fechmod = new Date();
  }
}
export class UserToken {
  UserID: number;
  token: string;
  createdDate: Date;
  expiredDate: Date;
  expired: boolean;

  constructor() {
    this.UserID = 0;
    this.token = '';
    this.createdDate = new Date();
    this.expiredDate = new Date();
    this.expired = false;
  }
}

export class login {
  Name: string;
  Password: string;

  constructor() {
    this.Name = '';
    this.Password = '';
  }
}

export class GoogleLoginData {
  googleId: string;
  password: string;

  constructor() {
    this.googleId = '';
    this.password = '';
  }
}

export class LinkGoogleAccount {
  userId: number;
  googleId: string;

  constructor() {
    this.userId = 0;
    this.googleId = '';
  }
}
