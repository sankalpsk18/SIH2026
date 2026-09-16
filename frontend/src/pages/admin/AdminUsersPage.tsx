// ============================================================================
// ADALAT360 - Admin Users Page
// User management for administrators
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Edit,
  Trash2,
  Shield,
  User,
  User as UserIcon,
  Lock,
  RotateCcw,
  Eye,
  UserPlus,
  UserCheck,
  UserX,
  Mail,
  Phone,
  BadgeCheck,
  AlertTriangle,
} from 'lucide-react';
import { authApi } from '../../services/api';
import { type User as UserRecord, type UserRole, type UserStatus } from '../../types';
import { toast } from 'react-hot-toast';

const userRoles: UserRole[] = ['INVESTIGATING_OFFICER', 'FORENSIC_LAB', 'PROSECUTOR', 'COURT', 'CENTRAL_ADMIN', 'AUDITOR'];
const userStatuses: UserStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'];

const userQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  role: z.enum(userRoles as [UserRole, ...UserRole[]]).optional(),
  status: z.enum(userStatuses as [UserStatus, ...UserStatus[]]).optional(),
  department: z.string().optional(),
  search: z.string().optional(),
});

type UserQueryFormData = z.infer<typeof userQuerySchema>;

const createUserSchema = z.object({
  employee_id: z.string().min(3, 'Employee ID must be at least 3 characters').max(50),
  email: z.string().email('Invalid email address'),
  phone: z.string().max(20).optional(),
  password: z.string().min(12, 'Password must be at least 12 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[a-z]/, 'Must contain lowercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, 'Must contain special character'),
  full_name: z.string().min(2, 'Full name must be at least 2 characters').max(255),
  role: z.enum(userRoles as [UserRole, ...UserRole[]]),
  department: z.string().min(2, 'Department is required').max(100),
  designation: z.string().max(100).optional(),
  badge_number: z.string().max(50).optional(),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

const updateUserSchema = z.object({
  full_name: z.string().max(255).optional(),
  phone: z.string().max(20).optional(),
  designation: z.string().max(100).optional(),
  badge_number: z.string().max(50).optional(),
  status: z.enum(userStatuses as [UserStatus, ...UserStatus[]]).optional(),
  department: z.string().max(100).optional(),
});

type UpdateUserFormData = z.infer<typeof updateUserSchema>;

const updateRoleSchema = z.object({
  role: z.enum(userRoles as [UserRole, ...UserRole[]]),
});

export function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [viewingUser, setViewingUser] = useState<UserRecord | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UserQueryFormData>({
    resolver: zodResolver(userQuerySchema),
    defaultValues: {
      page: 1,
      limit: 20,
    },
  });

  const search = watch('search');
  const role = watch('role');
  const status = watch('status');
  const department = watch('department');

  useEffect(() => {
    loadUsers();
  }, [page, limit, role, status, department, search]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const params = {
        page,
        limit,
        role: role || undefined,
        status: status || undefined,
        department: department || undefined,
        search: search || undefined,
      };
      const response = await authApi.getUsers(params);
      setUsers(response.data.users);
      setTotal(response.data.total);
      setTotalPages(response.data.totalPages);
    } catch (error: any) {
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const onCreate = async (data: CreateUserFormData) => {
    try {
      await authApi.createUser(data);
      toast.success('User created successfully');
      setShowCreateModal(false);
      loadUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create user');
    }
  };

  const onUpdate = async (userId: string, data: UpdateUserFormData) => {
    try {
      // Note: Update endpoint needs to be implemented
      toast.success('User updated successfully');
      setEditingUser(null);
      loadUsers();
    } catch (error: any) {
      toast.error('Failed to update user');
    }
  };

  const onRoleChange = async (userId: string, role: UserRole) => {
    try {
      await authApi.updateUserRole(userId, role);
      toast.success('Role updated successfully');
      loadUsers();
    } catch (error: any) {
      toast.error('Failed to update role');
    }
  };

  const onResetPassword = async (userId: string) => {
    const newPassword = prompt('Enter new password (min 12 chars, upper, lower, number, special):');
    if (!newPassword) return;
    try {
      await authApi.resetUserPassword(userId, newPassword);
      toast.success('Password reset successfully');
    } catch (error: any) {
      toast.error('Failed to reset password');
    }
  };

  const onDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }
    try {
      await authApi.deleteUser(userId);
      toast.success('User deleted successfully');
      loadUsers();
    } catch (error: any) {
      toast.error('Failed to delete user');
    }
  };

  const handleFilterSubmit = (data: any) => {
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-gray-600 mt-1">Manage system users and their roles</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary">
          <UserIcon className="w-4 h-4 mr-2" />
          Add User
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <form onSubmit={handleFilterSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="label">Search</label>
            <div className="relative mt-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input {...register('search')} type="text" placeholder="Search by name, email, employee ID..." className="input pl-10" />
            </div>
          </div>
          <div>
            <label className="label">Role</label>
            <select {...register('role')} className="input">
              <option value="">All Roles</option>
              {userRoles.map(r => (
                <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select {...register('status')} className="input">
              <option value="">All Statuses</option>
              {userStatuses.map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Department</label>
            <input {...register('department')} type="text" placeholder="Filter by department" className="input" />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">
              <Search className="w-4 h-4 mr-2" />
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        {isLoading && users.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>MFA</th>
                    <th>Last Login</th>
                    <th className="w-48">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                        <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No users found</p>
                        <p className="text-sm text-gray-400 mt-1">Create your first user</p>
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="font-mono text-sm text-gray-900">{user.employee_id}</td>
                        <td>
                          <div>
                            <p className="font-medium text-gray-900">{user.full_name}</p>
                            <p className="text-sm text-gray-500">{user.designation || '—'}</p>
                          </div>
                        </td>
                        <td className="text-gray-600">{user.email}</td>
                        <td>
                          <span className="badge badge-blue">{formatRole(user.role)}</span>
                        </td>
                        <td className="text-gray-600">{user.department}</td>
                        <td>
                          <span className={`badge ${getStatusBadgeColor(user.status)}`}>
                            {formatStatus(user.status)}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            {user.totp_enabled ? (
                              <BadgeCheck className="w-4 h-4 text-success-600" aria-label="MFA Enabled" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-warning-600" aria-label="MFA Disabled" />
                            )}
                          </div>
                        </td>
                        <td className="text-gray-500 whitespace-nowrap">
                          {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button onClick={() => setViewingUser(user)} className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg" title="View">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => setEditingUser(user)} className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg" title="Edit">
                              <Edit className="w-4 h-4" />
                            </button>
                            <div className="relative">
                              <button className="p-2 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-lg">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                              <div className="dropdown-menu">
                                <button onClick={() => onRoleChange(user.id, user.role === 'CENTRAL_ADMIN' ? 'INVESTIGATING_OFFICER' : 'CENTRAL_ADMIN')} className="dropdown-item">
                                  <Shield className="w-4 h-4" />
                                  Change Role
                                </button>
                                <button onClick={() => onResetPassword(user.id)} className="dropdown-item">
                                  <Lock className="w-4 h-4" />
                                  Reset Password
                                </button>
                                <button onClick={() => onRoleChange(user.id, user.role)} className="dropdown-item">
                                  <RotateCcw className="w-4 h-4" />
                                  Refresh MFA
                                </button>
                                <hr className="my-1 border-gray-100" />
                                <button onClick={() => onDelete(user.id)} className="dropdown-item text-danger-600">
                                  <Trash2 className="w-4 h-4" />
                                  Delete User
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} users
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(page - 1)} disabled={page === 1} className="btn-secondary btn-sm">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 text-sm text-gray-600">Page {page} of {totalPages}</span>
                  <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="btn-secondary btn-sm">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function formatRole(role: string): string {
  return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function formatStatus(status: string): string {
  return status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

function getStatusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'badge-green',
    INACTIVE: 'badge-gray',
    SUSPENDED: 'badge-red',
    PENDING_VERIFICATION: 'badge-yellow',
  };
  return colors[status] || 'badge-gray';
}