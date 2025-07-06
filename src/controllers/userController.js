const User = require('../models/User');
const authService = require('../services/authService');

class UserController {
  // GET /api/users
  async getUsers(req, res, next) {
    try {
      const { page = 1, limit = 25, sort = 'createdAt', order = 'desc', search, role, isActive } = req.query;
      
      // Construir filtros
      const filters = {
        organization: req.user.organization._id,
        isDeleted: false
      };

      // Filtro por búsqueda (nombre, email)
      if (search) {
        filters.$or = [
          { email: { $regex: search, $options: 'i' } },
          { 'profile.firstName': { $regex: search, $options: 'i' } },
          { 'profile.lastName': { $regex: search, $options: 'i' } }
        ];
      }

      // Filtro por rol
      if (role) {
        filters.role = role;
      }

      // Filtro por estado activo
      if (isActive !== undefined) {
        filters.isActive = isActive === 'true';
      }

      // Configurar ordenamiento
      const sortField = sort;
      const sortOrder = order === 'desc' ? -1 : 1;
      const sortObj = { [sortField]: sortOrder };

      // Ejecutar consulta con paginación
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const [users, total] = await Promise.all([
        User.find(filters)
          .select('-password')
          .populate('organization', 'name type')
          .sort(sortObj)
          .skip(skip)
          .limit(parseInt(limit)),
        User.countDocuments(filters)
      ]);

      const totalPages = Math.ceil(total / parseInt(limit));

      res.status(200).json({
        status: 'success',
        data: {
          users,
          pagination: {
            currentPage: parseInt(page),
            totalPages,
            totalUsers: total,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // GET /api/users/:id
  async getUserById(req, res, next) {
    try {
      const { id } = req.params;

      const user = await User.findOne({
        _id: id,
        organization: req.user.organization._id,
        isDeleted: false
      })
      .select('-password')
      .populate('organization', 'name type')
      .populate('createdBy', 'profile.firstName profile.lastName email');

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'Usuario no encontrado'
        });
      }

      res.status(200).json({
        status: 'success',
        data: { user }
      });

    } catch (error) {
      next(error);
    }
  }

  // POST /api/users
  async createUser(req, res, next) {
    try {
      const userData = {
        ...req.body,
        organization: req.user.organization._id
      };

      const user = await authService.createUser(userData, req.user._id);

      res.status(201).json({
        status: 'success',
        message: 'Usuario creado exitosamente',
        data: { user }
      });

    } catch (error) {
      next(error);
    }
  }

  // PUT /api/users/:id
  async updateUser(req, res, next) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      // No permitir actualizar campos sensibles
      delete updateData.password;
      delete updateData.organization;
      delete updateData.security;
      delete updateData.isDeleted;

      // Solo admin puede cambiar roles
      if (updateData.role && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          status: 'error',
          message: 'No tiene permisos para cambiar roles'
        });
      }

      const user = await User.findOneAndUpdate(
        {
          _id: id,
          organization: req.user.organization._id,
          isDeleted: false
        },
        {
          ...updateData,
          updatedBy: req.user._id
        },
        {
          new: true,
          runValidators: true
        }
      )
      .select('-password')
      .populate('organization', 'name type');

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'Usuario no encontrado'
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'Usuario actualizado exitosamente',
        data: { user }
      });

    } catch (error) {
      next(error);
    }
  }

  // DELETE /api/users/:id
  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;

      // No permitir auto-eliminación
      if (id === req.user._id.toString()) {
        return res.status(400).json({
          status: 'error',
          message: 'No puede eliminar su propia cuenta'
        });
      }

      const user = await User.findOneAndUpdate(
        {
          _id: id,
          organization: req.user.organization._id,
          isDeleted: false
        },
        {
          isDeleted: true,
          isActive: false,
          deletedAt: new Date(),
          deletedBy: req.user._id
        },
        { new: true }
      );

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'Usuario no encontrado'
        });
      }

      res.status(200).json({
        status: 'success',
        message: 'Usuario eliminado exitosamente'
      });

    } catch (error) {
      next(error);
    }
  }

  // PATCH /api/users/:id/toggle-status
  async toggleUserStatus(req, res, next) {
    try {
      const { id } = req.params;

      // No permitir desactivar cuenta propia
      if (id === req.user._id.toString()) {
        return res.status(400).json({
          status: 'error',
          message: 'No puede desactivar su propia cuenta'
        });
      }

      const user = await User.findOne({
        _id: id,
        organization: req.user.organization._id,
        isDeleted: false
      });

      if (!user) {
        return res.status(404).json({
          status: 'error',
          message: 'Usuario no encontrado'
        });
      }

      user.isActive = !user.isActive;
      user.updatedBy = req.user._id;
      await user.save();

      res.status(200).json({
        status: 'success',
        message: `Usuario ${user.isActive ? 'activado' : 'desactivado'} exitosamente`,
        data: {
          user: {
            id: user._id,
            isActive: user.isActive
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }

  // PUT /api/users/profile
  async updateProfile(req, res, next) {
    try {
      const userId = req.user._id;
      const updateData = req.body;

      // Solo permitir actualizar campos del perfil y preferencias
      const allowedUpdates = {
        'profile.firstName': updateData.profile?.firstName,
        'profile.lastName': updateData.profile?.lastName,
        'profile.phone': updateData.profile?.phone,
        'profile.position': updateData.profile?.position,
        'profile.department': updateData.profile?.department,
        'preferences.language': updateData.preferences?.language,
        'preferences.theme': updateData.preferences?.theme,
        'preferences.notifications': updateData.preferences?.notifications,
        'preferences.dashboard': updateData.preferences?.dashboard
      };

      // Filtrar valores undefined
      Object.keys(allowedUpdates).forEach(key => {
        if (allowedUpdates[key] === undefined) {
          delete allowedUpdates[key];
        }
      });

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: allowedUpdates },
        {
          new: true,
          runValidators: true
        }
      )
      .select('-password')
      .populate('organization', 'name type');

      res.status(200).json({
        status: 'success',
        message: 'Perfil actualizado exitosamente',
        data: { user }
      });

    } catch (error) {
      next(error);
    }
  }

  // GET /api/users/stats
  async getUserStats(req, res, next) {
    try {
      const organizationId = req.user.organization._id;

      const stats = await User.aggregate([
        {
          $match: {
            organization: organizationId,
            isDeleted: false
          }
        },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            activeUsers: {
              $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
            },
            adminUsers: {
              $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] }
            },
            analystUsers: {
              $sum: { $cond: [{ $eq: ['$role', 'analyst'] }, 1, 0] }
            },
            viewerUsers: {
              $sum: { $cond: [{ $eq: ['$role', 'viewer'] }, 1, 0] }
            },
            verifiedUsers: {
              $sum: { $cond: [{ $eq: ['$security.emailVerified', true] }, 1, 0] }
            }
          }
        }
      ]);

      const result = stats[0] || {
        totalUsers: 0,
        activeUsers: 0,
        adminUsers: 0,
        analystUsers: 0,
        viewerUsers: 0,
        verifiedUsers: 0
      };

      res.status(200).json({
        status: 'success',
        data: { stats: result }
      });

    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();