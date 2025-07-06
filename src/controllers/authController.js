const authService = require('../services/authService');

class AuthController {
  // POST /api/auth/register-organization
  async registerOrganization(req, res, next) {
    try {
      const { organization, user } = req.body;

      if (!organization || !user) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos de organización y usuario son requeridos'
        });
      }

      const result = await authService.registerOrganizationWithAdmin(organization, user);

      // Configurar cookie con refresh token
      res.cookie('refreshToken', result.tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
      });

      res.status(201).json({
        status: 'success',
        message: 'Organización y usuario registrados exitosamente',
        data: {
          user: result.user,
          organization: result.organization,
          tokens: {
            access_token: result.tokens.access_token,
            token_type: result.tokens.token_type,
            expires_in: result.tokens.expires_in
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/login
  // In your authController.js, update the login method error handling:

// En tu authController.js, actualiza el método login para mejor debugging:

async login(req, res, next) {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;

    console.log(`🔍 Intentando login para: ${email}`);

    const result = await authService.login(email, password, ipAddress);

    console.log(`✅ AuthService devolvió resultado para ${email}:`, {
      hasUser: !!result.user,
      hasTokens: !!result.tokens,
      userId: result.user?.id,
      accessToken: result.tokens?.access_token ? 'presente' : 'ausente'
    });

    // Configurar cookie con refresh token
    res.cookie('refreshToken', result.tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    const responseData = {
      status: 'success',
      message: 'Login exitoso',
      data: {
        user: result.user,
        tokens: {
          access_token: result.tokens.access_token,
          token_type: result.tokens.token_type,
          expires_in: result.tokens.expires_in
        }
      }
    };

    console.log(`📤 Enviando respuesta para ${email}:`, {
      status: responseData.status,
      hasUser: !!responseData.data.user,
      hasAccessToken: !!responseData.data.tokens.access_token,
      accessTokenLength: responseData.data.tokens.access_token?.length || 0
    });

    res.status(200).json(responseData);

  } catch (error) {
    console.log(`❌ Error en login para ${req.body?.email}: ${error.message}`);
    console.log(`📍 Stack trace:`, error.stack);
    next(error);
  }
}

  // POST /api/auth/logout
  async logout(req, res, next) {
    try {
      // Limpiar cookie de refresh token
      res.clearCookie('refreshToken');

      res.status(200).json({
        status: 'success',
        message: 'Logout exitoso'
      });

    } catch (error) {
      next(error);
    }
  }

  // GET /api/auth/me
  async getProfile(req, res, next) {
    try {
      const user = req.user;

      res.status(200).json({
        status: 'success',
        data: {
          user: {
            id: user._id,
            email: user.email,
            profile: user.profile,
            role: user.role,
            organization: {
              id: user.organization._id,
              name: user.organization.name,
              type: user.organization.type
            },
            preferences: user.preferences,
            emailVerified: user.security.emailVerified,
            lastLogin: user.security.lastLogin
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/change-password
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user._id;

      const result = await authService.changePassword(userId, currentPassword, newPassword);

      res.status(200).json({
        status: 'success',
        message: result.message
      });

    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/forgot-password
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      const result = await authService.generatePasswordResetToken(email);

      // TODO: Enviar email con token de reset
      // await emailService.sendPasswordResetEmail(email, result.resetToken);

      res.status(200).json({
        status: 'success',
        message: result.message
      });

    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/reset-password
  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;

      const result = await authService.resetPassword(token, newPassword);

      res.status(200).json({
        status: 'success',
        message: result.message
      });

    } catch (error) {
      next(error);
    }
  }

  // POST /api/auth/verify-token
  async verifyToken(req, res, next) {
    try {
      // Si llegamos aquí, el token es válido (verificado por middleware auth)
      res.status(200).json({
        status: 'success',
        message: 'Token válido',
        data: {
          valid: true,
          user: req.user
        }
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();