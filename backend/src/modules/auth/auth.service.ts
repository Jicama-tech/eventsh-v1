import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { UsersService } from "../users/users.service";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) {}

  async validateUser(email: string, pass: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const match = await bcrypt.compare(pass, user.password);
    if (match) {
      const { password, ...rest } = user.toObject ? user.toObject() : user;
      return rest;
    }
    return null;
  }

  async login(user: any) {
    const payload = {
      sub: user._id,
      email: user.email,
      roles: user.roles || [],
    };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
