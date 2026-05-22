import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../entities/user.entity';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { AppException } from '../../common/app-exception';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as Reflector;

    guard = new RolesGuard(reflector);
  });

  function createMockExecutionContext(user?: any) {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user }),
      }),
    } as any;
  }

  it('should allow access when reflector returns undefined (no roles required)', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    const context = createMockExecutionContext({ role: UserRole.USER });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  it('should allow access when reflector returns an empty array (no roles required)', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([]);
    const context = createMockExecutionContext({ role: UserRole.USER });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should allow access when user has the required role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);
    const context = createMockExecutionContext({ role: UserRole.ADMIN });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when user has the wrong role', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);
    const context = createMockExecutionContext({ role: UserRole.USER });

    expect(() => guard.canActivate(context)).toThrow(AppException);
  });

  it('should throw ForbiddenException when no user is on the request', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([UserRole.ADMIN]);
    const context = createMockExecutionContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(AppException);
  });
});
