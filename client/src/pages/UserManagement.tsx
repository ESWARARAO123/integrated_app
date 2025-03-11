import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: string;
  created_at: string;
}

interface UserFormData {
  name: string;
  username: string;
  email: string;
  password: string;
  role: string;
}

const defaultUserForm: UserFormData = {
  name: '',
  username: '',
  email: '',
  password: '',
  role: 'viewer'
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState<UserFormData>(defaultUserForm);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users');
      setUsers(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setUserForm({
        name: user.name,
        username: user.username,
        email: user.email,
        password: '', // Don't populate password for editing
        role: user.role
      });
    } else {
      setEditingUser(null);
      setUserForm(defaultUserForm);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingUser(null);
    setUserForm(defaultUserForm);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingUser) {
        // Remove empty fields from update
        const updateData = Object.entries(userForm).reduce((acc, [key, value]) => {
          if (value !== '') {
            acc[key] = value;
          }
          return acc;
        }, {} as Partial<UserFormData>);

        await api.put(`/users/${editingUser.id}`, updateData);
      } else {
        await api.post('/users', userForm);
      }
      
      handleCloseModal();
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || `Failed to ${editingUser ? 'update' : 'create'} user`);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await api.delete(`/users/${userId}`);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-grafana-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl md:text-2xl font-bold">User Management</h2>
        <button
          onClick={() => handleOpenModal()}
          className="btn-primary flex items-center justify-center sm:justify-start"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          Add User
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 rounded p-3">
          {error}
        </div>
      )}

      <div className="bg-grafana-dark rounded-lg shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-800">
            <thead className="bg-grafana-secondary">
              <tr>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden sm:table-cell">
                  Username
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden md:table-cell">
                  Email
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider hidden lg:table-cell">
                  Created At
                </th>
                <th className="px-4 md:px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-grafana-secondary/10">
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">{user.name}</td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden sm:table-cell">{user.username}</td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">{user.email}</td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      user.role === 'admin' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-gray-300 hidden lg:table-cell">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 md:px-6 py-4 whitespace-nowrap text-right space-x-3">
                    <button
                      onClick={() => handleOpenModal(user)}
                      className="text-blue-400 hover:text-blue-300 inline-flex items-center"
                    >
                      <PencilIcon className="w-4 h-4" />
                      <span className="hidden sm:inline ml-1">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="text-red-400 hover:text-red-300 inline-flex items-center"
                    >
                      <TrashIcon className="w-4 h-4" />
                      <span className="hidden sm:inline ml-1">Delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Modal (Create/Edit) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-grafana-dark p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">
              {editingUser ? 'Edit User' : 'Create New User'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Username</label>
                <input
                  type="text"
                  className="input-field w-full"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  className="input-field w-full"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Password {editingUser && '(leave blank to keep current)'}
                </label>
                <input
                  type="password"
                  className="input-field w-full"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  required={!editingUser}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  className="input-field w-full"
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                >
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-300 hover:text-white"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingUser ? 'Update' : 'Create'} User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 