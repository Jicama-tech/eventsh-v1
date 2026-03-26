import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class InstagramAuthGuard extends AuthGuard('instagram') {}
