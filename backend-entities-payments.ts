/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DATABASE ENTITIES — PostgreSQL TypeORM
 * USER ENTITY + RBAC + COURSE + PAYMENT GATEWAY (Stripe/Dodo)
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ── src/modules/users/entities/user.entity.ts ───────────────────────────────
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany, Index, BeforeInsert, BeforeUpdate,
} from 'typeorm';

export type UserRole = 'admin' | 'creator' | 'user';
export type UserProvider = 'local' | 'google' | 'github';

@Entity('users')
@Index(['email'], { unique: true })
@Index(['providerId', 'provider'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true, select: false })
  passwordHash?: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'avatar_url' })
  avatarUrl?: string;

  @Column({ type: 'enum', enum: ['admin', 'creator', 'user'], default: 'user' })
  role: UserRole;

  @Column({ type: 'enum', enum: ['local', 'google', 'github'], default: 'local' })
  provider: UserProvider;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'provider_id' })
  providerId?: string;

  @Column({ type: 'boolean', default: false, name: 'email_verified' })
  emailVerified: boolean;

  @Column({ type: 'boolean', default: false, name: 'mfa_enabled' })
  mfaEnabled: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, select: false, name: 'mfa_secret' })
  mfaSecret?: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>; // extensible user data

  @Column({ type: 'timestamp', nullable: true, name: 'last_login_at' })
  lastLoginAt?: Date;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'stripe_customer_id' })
  stripeCustomerId?: string;

  @Column({ type: 'varchar', length: 50, default: 'free', name: 'subscription_plan' })
  subscriptionPlan: 'free' | 'pro' | 'expert';

  @Column({ type: 'timestamp', nullable: true, name: 'subscription_expires_at' })
  subscriptionExpiresAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  normalizeEmail() {
    if (this.email) this.email = this.email.toLowerCase().trim();
  }
}


// ── src/modules/auth/entities/refresh-token.entity.ts ───────────────────────
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, Index } from 'typeorm';

@Entity('refresh_tokens')
@Index(['userId', 'revoked'])
@Index(['expiresAt'])
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 1000 })
  token: string; // stored as Argon2 hash

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column({ type: 'boolean', default: false })
  revoked: boolean;

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'varchar', length: 50, nullable: true })
  userAgent?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}


// ── src/modules/auth/entities/audit-log.entity.ts ──────────────────────────
@Entity('audit_logs')
@Index(['userId'])
@Index(['action', 'createdAt'])
@Index(['ip'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId?: string;

  @Column({ type: 'varchar', length: 100 })
  action: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string;

  @Column({ type: 'varchar', length: 50 })
  ip: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}


// ── src/modules/courses/entities/course.entity.ts ──────────────────────────
@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'thumbnail_url' })
  thumbnailUrl?: string;

  @Column({ type: 'enum', enum: ['free', 'pro', 'expert'], default: 'pro', name: 'required_plan' })
  requiredPlan: string;

  @Column({ type: 'boolean', default: true, name: 'is_published' })
  isPublished: boolean;

  @Column({ type: 'int', default: 0 })
  order: number;

  @OneToMany(() => Module, (m) => m.course, { cascade: true })
  modules: Module[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}


// ── src/modules/payments/payments.service.ts ────────────────────────────────
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { Payment } from './entities/payment.entity';

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    private config: ConfigService,
  ) {
    this.stripe = new Stripe(config.get('STRIPE_SECRET_KEY'), {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    });
  }

  // ── CREATE CHECKOUT SESSION ──────────────────────────────────────────────
  async createCheckoutSession(userId: string, plan: 'pro' | 'expert') {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId },
      });
      customerId = customer.id;
      await this.userRepo.update(userId, { stripeCustomerId: customerId });
    }

    const priceId = plan === 'pro'
      ? this.config.get('STRIPE_PRICE_PRO')
      : this.config.get('STRIPE_PRICE_EXPERT');

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card', 'boleto', 'pix'], // Brazilian payment methods
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: `${this.config.get('FRONTEND_URL')}/checkout/success?session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.config.get('FRONTEND_URL')}/precos`,
      metadata: { userId, plan },
      locale: 'pt-BR',
      allow_promotion_codes: true,
      discounts: [{
        coupon: await this.getOrCreateCoupon('ACELERA10'),
      }],
    });

    return { url: session.url, sessionId: session.id };
  }

  // ── WEBHOOK HANDLER (idempotent) ─────────────────────────────────────────
  async handleWebhook(payload: Buffer, signature: string) {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.config.get('STRIPE_WEBHOOK_SECRET'),
      );
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Idempotency check — skip already processed events
    const processed = await this.paymentRepo.findOne({ where: { stripeEventId: event.id } });
    if (processed) {
      this.logger.warn(`Duplicate webhook event: ${event.id}`);
      return { received: true };
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;
    }

    // Record event for idempotency
    await this.paymentRepo.save(this.paymentRepo.create({
      stripeEventId: event.id,
      type: event.type,
      status: 'processed',
    }));

    return { received: true };
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const { userId, plan } = session.metadata;
    await this.userRepo.update(userId, {
      subscriptionPlan: plan as any,
      subscriptionExpiresAt: null, // lifetime access
    });
    this.logger.log(`Upgraded user ${userId} to plan ${plan}`);
  }

  private async handlePaymentFailed(intent: Stripe.PaymentIntent) {
    this.logger.error(`Payment failed for customer ${intent.customer}`);
  }

  private async handleSubscriptionCanceled(sub: Stripe.Subscription) {
    const customer = await this.stripe.customers.retrieve(sub.customer as string);
    const userId = (customer as Stripe.Customer).metadata?.userId;
    if (userId) await this.userRepo.update(userId, { subscriptionPlan: 'free' });
  }

  private async getOrCreateCoupon(code: string): Promise<string> {
    try {
      const coupon = await this.stripe.coupons.retrieve(code);
      return coupon.id;
    } catch {
      const newCoupon = await this.stripe.coupons.create({
        id: code,
        percent_off: 10,
        duration: 'once',
      });
      return newCoupon.id;
    }
  }
}


// ── src/common/guards/roles.guard.ts ────────────────────────────────────────
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!requiredRoles?.length) return true; // no role requirement

    const { user } = ctx.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Authentication required');

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) throw new ForbiddenException('Insufficient permissions');

    return true;
  }
}

// Usage: @Roles('admin') @UseGuards(JwtAuthGuard, RolesGuard)


// ── src/common/guards/plan.guard.ts ─────────────────────────────────────────
@Injectable()
export class PlanGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const requiredPlan = this.reflector.get<string>('required_plan', ctx.getHandler());
    if (!requiredPlan) return true;

    const { user } = ctx.switchToHttp().getRequest();
    const hierarchy = { free: 0, pro: 1, expert: 2 };
    const userLevel = hierarchy[user.subscriptionPlan] || 0;
    const requiredLevel = hierarchy[requiredPlan] || 0;

    if (userLevel < requiredLevel) {
      throw new ForbiddenException(`This content requires the ${requiredPlan} plan. Upgrade to access.`);
    }
    return true;
  }
}
