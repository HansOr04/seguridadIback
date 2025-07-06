const authService = require('../services/authService');
const { validationResult } = require('express-validator');

// POST /api/auth/register-organization
const registerOrganization = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Datos de entrada inválidos',
        errors: errors.array(),
        timestamp: new Date().toISOString()
      });
    }

    const { organization, user } = req.body;
    const result = await authService.registerOrganization(organization, user);

    res.status(201).json({
      status: 'success',
      message: result.message,
      data: {
        organization: result.organization,
        user: result.user
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Error en registro de organización:`, error);
    next(error);
  }
};

// POST /api/auth/register
const register = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos de entrada inválidos',
          errors: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const userData = req.body;
      const result = await authService.register(userData);

      res.status(201).json({
        status: 'success',
        message: result.message,
        data: {
          user: result.user
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error(`Error en registro:`, error);
      next(error);
    }
  }

// POST /api/auth/login
const login = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos de entrada inválidos',
          errors: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const { email, password } = req.body;
      
      console.log(`🔍 Intentando login para: ${email}`);

      // Llamar al servicio de autenticación
      const responseData = await authService.login(email, password);
      
      console.log(`✅ AuthService devolvió resultado para ${email}:`, {
        hasUser: !!responseData.data.user,
        hasTokens: !!responseData.data.tokens,
        userId: responseData.data.user?._id,
        accessToken: responseData.data.tokens?.access_token ? 'presente' : 'ausente'
      });

      // CORRECCIÓN CRÍTICA: El frontend espera que los tokens estén en el nivel superior
      const correctedResponse = {
        status: 'success',
        message: responseData.message,
        data: {
          user: responseData.data.user,
          // Tokens en el nivel superior para compatibilidad con el frontend
          tokens: responseData.data.tokens,
          // También incluir el access_token directamente
          access_token: responseData.data.tokens.access_token,
          refresh_token: responseData.data.tokens.refresh_token
        },
        timestamp: new Date().toISOString()
      };

      console.log(`📤 Enviando respuesta corregida para ${email}:`, {
        status: correctedResponse.status,
        hasUser: !!correctedResponse.data.user,
        hasAccessToken: !!correctedResponse.data.access_token,
        accessTokenLength: correctedResponse.data.access_token?.length || 0,
        hasTokensObject: !!correctedResponse.data.tokens
      });

      // Establecer cookie para refresh token (opcional)
      if (responseData.data.tokens.refresh_token) {
        res.cookie('refreshToken', responseData.data.tokens.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
        });
      }

      res.status(200).json(correctedResponse);

    } catch (error) {
      console.log(`❌ Error en login para ${req.body?.email}: ${error.message}`);
      console.log(`📍 Stack trace:`, error.stack);
      next(error);
    }
  }

// POST /api/auth/logout
const logout = async (req, res, next) => {
    try {
      // Limpiar cookie de refresh token
      res.clearCookie('refreshToken');

      res.status(200).json({
        status: 'success',
        message: 'Logout exitoso',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      next(error);
    }
  }

// GET /api/auth/me
const getProfile = async (req, res, next) => {
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
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      next(error);
    }
  }

// POST /api/auth/verify-token
const verifyToken = async (req, res, next) => {
    try {
      // Si llegamos aquí, el token es válido (verificado por middleware auth)
      res.status(200).json({
        status: 'success',
        message: 'Token válido',
        data: {
          user: {
            id: req.user._id,
            email: req.user.email,
            profile: req.user.profile,
            role: req.user.role,
            organization: {
              id: req.user.organization._id,
              name: req.user.organization.name,
              type: req.user.organization.type
            }
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error verificando token:', error);
      next(error);
    }
  }

// POST /api/auth/change-password
const changePassword = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos de entrada inválidos',
          errors: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const { currentPassword, newPassword } = req.body;
      const userId = req.user._id;

      const result = await authService.changePassword(userId, currentPassword, newPassword);

      res.status(200).json({
        status: 'success',
        message: result.message,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      next(error);
    }
  }

// POST /api/auth/forgot-password
const forgotPassword = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos de entrada inválidos',
          errors: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const { email } = req.body;

      const result = await authService.generatePasswordResetToken(email);

      // TODO: Enviar email con token de reset
      // await emailService.sendPasswordResetEmail(email, result.resetToken);

      res.status(200).json({
        status: 'success',
        message: result.message,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      next(error);
    }
  }

// POST /api/auth/reset-password
const resetPassword = async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: 'error',
          message: 'Datos de entrada inválidos',
          errors: errors.array(),
          timestamp: new Date().toISOString()
        });
      }

      const { token, newPassword } = req.body;

      const result = await authService.resetPassword(token, newPassword);

      res.status(200).json({
        status: 'success',
        message: result.message,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      next(error);
    }
  }

// POST /api/auth/refresh-token
const refreshToken = async (req, res, next) => {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refresh_token;

      if (!refreshToken) {
        return res.status(401).json({
          status: 'error',
          message: 'Refresh token no proporcionado',
          timestamp: new Date().toISOString()
        });
      }

      const result = await authService.refreshToken(refreshToken);

      // Establecer nueva cookie de refresh token
      if (result.data.tokens.refresh_token) {
        res.cookie('refreshToken', result.data.tokens.refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
        });
      }

      res.status(200).json({
        status: 'success',
        message: result.message,
        data: {
          access_token: result.data.tokens.access_token,
          tokens: result.data.tokens,
          user: result.data.user
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      next(error);
    }
  }

module.exports = {
  registerOrganization,
  register,
  login,
  logout,
  getProfile,
  verifyToken,
  changePassword,
  forgotPassword,
  resetPassword,
  refreshToken
};