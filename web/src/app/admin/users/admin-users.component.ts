import { Component, signal, inject, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../shared/auth.service';
import { AdminApi, AdminUserRow } from '../../shared/api/admin-api.service';
import { ToastService } from '../../shared/api/toast.service';
import { AdminUser, CreateUserFormValue, FirmOption } from './user.types';
import { UserListComponent } from './user-list.component';
import { UserFormComponent } from './user-form.component';
import { UserPasswordModalComponent } from './user-password-modal.component';
import { UserDeleteModalComponent } from './user-delete-modal.component';

/**
 * Coordinator for the admin Users tab. Owns the cross-firm user list plus the
 * create/detail panel and all API calls; the child components are presentational.
 *
 * Deep-linkable state (URL-follows-state, merged query params):
 *   - `?action=create`  → the provisioning form is open
 *   - `?userId=<id>`    → a user's read-only detail is open
 *   - `?created=<id>`   → the one-time temporary-password reveal modal for a
 *                         just-created user (password itself is transient — it
 *                         lives only in a signal, never in the URL/DB, so a
 *                         direct navigation falls back to a "not available" note)
 *   - `?reset=<id>`     → the same reveal modal for an admin-initiated password
 *                         reset (reset variant; password equally transient)
 *   - `?delete=<id>`    → the hard-delete confirm modal for that user
 *                         (`#/admin/users?delete=<id>` is directly shareable)
 *   - `?role=<ROLE>`    → the role filter
 *   - `?q=<text>`       → the search box
 * Every navigable sub-state is restored from the URL on load, so it is
 * shareable and reproducible for post-deploy verification.
 */
@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [UserListComponent, UserFormComponent, UserPasswordModalComponent, UserDeleteModalComponent],
  template: `
    @if (deleteUserId()) {
      <app-user-delete-modal
        [user]="deleteUser()"
        [deleting]="deleting()"
        (confirm)="confirmDelete()"
        (close)="closeDeleteModal()"
      />
    }

    @if (createdUserId()) {
      <app-user-password-modal
        [password]="temporaryPassword()"
        (close)="closeCreatedModal()"
      />
    }

    @if (resetUserId()) {
      <app-user-password-modal
        [password]="temporaryPassword()"
        [reset]="true"
        (close)="closeResetModal()"
      />
    }

    @if (showCreate() || selectedUser()) {
      <app-user-form
        [user]="selectedUser()"
        [firms]="firms()"
        [saving]="saving()"
        (back)="closePanel()"
        (save)="createUser($event)"
        (resetPassword)="requestReset($event)"
        (deleteRequested)="requestDelete($event)"
      />
    } @else {
      <app-user-list
        [users]="filteredUsers()"
        [roleFilter]="roleFilter"
        [search]="search"
        [sortField]="sortState.field"
        [sortDirection]="sortState.direction"
        (userSelected)="selectUser($event)"
        (roleFilterChange)="onRoleFilterChange($event)"
        (searchChange)="onSearchChange($event)"
        (sortChanged)="sortTable($event.field)"
        (createClicked)="openCreate()"
        (deleteRequested)="requestDelete($event)"
      />
    }
  `
})
export class AdminUsersComponent implements OnInit {
  private auth = inject(AuthService);
  private adminApi = inject(AdminApi);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  users = signal<AdminUser[]>([]);
  firms = signal<FirmOption[]>([]);
  selectedUser = signal<AdminUser | null>(null);
  showCreate = signal<boolean>(false);
  saving = signal<boolean>(false);

  /**
   * The user id whose temporary-password reveal modal is open (mirrors
   * `?created`), and the transient one-time password to show. The password is
   * only ever set in-session right after a successful create — it is never
   * persisted or placed in the URL, so on a direct/refreshed navigation it stays
   * null and the modal shows a fallback message.
   */
  createdUserId = signal<string | null>(null);
  /**
   * The user id whose password-reset reveal modal is open (mirrors `?reset`).
   * Shares the transient `temporaryPassword` signal with the create flow — the
   * plaintext is surfaced once, never persisted or placed in the URL.
   */
  resetUserId = signal<string | null>(null);
  temporaryPassword = signal<string | null>(null);

  /**
   * The user id whose hard-delete confirm modal is open (mirrors `?delete`).
   * `#/admin/users?delete=<id>` is directly shareable — on a direct navigation
   * the row may not be in `users()` yet, so `deleteUser()` can be null and the
   * modal falls back to generic copy.
   */
  deleteUserId = signal<string | null>(null);
  /** True while the DELETE request is in flight (disables the modal buttons). */
  deleting = signal<boolean>(false);

  roleFilter = 'all';
  search = '';
  sortState: { field: string; direction: 'asc' | 'desc' } = { field: 'createdAt', direction: 'desc' };

  async ngOnInit() {
    await this.refreshUsers();
    // Restore deep-linked sub-state from the URL. Subscribe (not snapshot) so
    // the panel/filter reconciles once the tab's query params actually arrive.
    this.route.queryParamMap.subscribe(params => {
      const role = params.get('role');
      if (role) this.roleFilter = role;
      const q = params.get('q');
      if (q !== null) this.search = q;

      // `?delete=<id>` — restore the destructive confirm modal from the URL.
      this.deleteUserId.set(params.get('delete') || null);

      const created = params.get('created');
      const reset = params.get('reset');
      this.createdUserId.set(created || null);
      this.resetUserId.set(reset || null);
      // Leaving both reveal states discards the transient one-time password.
      if (!created && !reset) this.temporaryPassword.set(null);

      const action = params.get('action');
      const userId = params.get('userId');
      if (userId) {
        this.showCreate.set(false);
        const found = this.users().find(u => u.id === userId);
        if (found && this.selectedUser()?.id !== userId) this.selectedUser.set(found);
      } else if (action === 'create') {
        this.selectedUser.set(null);
        this.showCreate.set(true);
      } else {
        this.selectedUser.set(null);
        this.showCreate.set(false);
      }
    });
  }

  private async refreshUsers() {
    try {
      const rows = await this.adminApi.listUsers();
      this.users.set((rows ?? []).map(r => this.toAdminUser(r)));
    } catch {
      // keep whatever is currently shown
    }
  }

  private toAdminUser(r: AdminUserRow): AdminUser {
    return {
      id: r.id,
      email: r.email,
      name: r.name ?? '',
      role: r.role,
      firmId: r.firmId ?? null,
      firmName: r.firm?.name ?? null,
      createdAt: (r.createdAt ?? '').slice(0, 10),
      lastConversationAt: (r.lastConversationAt ?? '').slice(0, 10),
    };
  }

  filteredUsers(): AdminUser[] {
    let list = this.users();
    if (this.roleFilter !== 'all') list = list.filter(u => u.role === this.roleFilter);
    const q = this.search.trim().toLowerCase();
    if (q) list = list.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    return list;
  }

  // ----- list interactions (deep-linked) -----

  onRoleFilterChange(role: string) {
    this.roleFilter = role;
    void this.router.navigate([], {
      queryParams: { role: role === 'all' ? null : role },
      queryParamsHandling: 'merge',
    });
  }

  onSearchChange(q: string) {
    this.search = q;
    void this.router.navigate([], {
      queryParams: { q: q.trim() ? q : null },
      queryParamsHandling: 'merge',
    });
  }

  selectUser(user: AdminUser) {
    this.showCreate.set(false);
    this.selectedUser.set(user);
    void this.router.navigate([], {
      queryParams: { userId: user.id, action: null, created: null, reset: null },
      queryParamsHandling: 'merge',
    });
  }

  openCreate() {
    this.selectedUser.set(null);
    this.showCreate.set(true);
    void this.router.navigate([], {
      queryParams: { action: 'create', userId: null, created: null, reset: null },
      queryParamsHandling: 'merge',
    });
  }

  closePanel() {
    this.selectedUser.set(null);
    this.showCreate.set(false);
    void this.router.navigate([], {
      queryParams: { action: null, userId: null, created: null, reset: null, delete: null },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Dismiss the temporary-password reveal modal. Clearing `?created` from the URL
   * is what actually closes it — the queryParamMap subscription reconciles the
   * signals (createdUserId/temporaryPassword back to null), so the modal state
   * stays fully URL-addressable, matching the action/userId modal pattern.
   */
  closeCreatedModal() {
    void this.router.navigate([], {
      queryParams: { created: null },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Admin-initiated password reset. A bilingual confirm() gates the destructive
   * action; on confirm we call the
   * reset endpoint, stash the transient one-time password in the shared signal,
   * and deep-link to `?reset=<id>` to open the reveal modal (password stays out
   * of the URL — signal only). The detail panel (`?userId`) stays open behind it.
   */
  async requestReset(user: AdminUser) {
    const confirmed = confirm(`Generate a new temporary password for ${user.email}? The user's current password will stop working.`);
    if (!confirmed) return;
    this.saving.set(true);
    try {
      const result = await this.adminApi.resetPassword(user.id);
      this.temporaryPassword.set(result.temporaryPassword ?? null);
      void this.router.navigate([], {
        queryParams: { reset: result.id, created: null, action: null },
        queryParamsHandling: 'merge',
      });
    } catch (err: any) {
      alert(`Failed to reset password: ${err?.message ?? err}`);
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Dismiss the reset reveal modal. Clearing `?reset` from the URL reconciles the
   * signals via the queryParamMap subscription, keeping the state URL-addressable.
   */
  closeResetModal() {
    void this.router.navigate([], {
      queryParams: { reset: null },
      queryParamsHandling: 'merge',
    });
  }

  // ----- hard delete (deep-linked confirm modal) -----

  /** The row behind `?delete=<id>`, or null if it isn't loaded (direct nav). */
  deleteUser(): AdminUser | null {
    const id = this.deleteUserId();
    if (!id) return null;
    return this.users().find(u => u.id === id) ?? null;
  }

  /**
   * Open the confirm modal for a hard delete. State lives in the URL only —
   * `?delete=<id>` is what renders the modal (via the queryParamMap
   * subscription), so `#/admin/users?delete=<id>` is shareable and reproducible.
   * Deliberately no window.confirm(): the confirmation must be addressable.
   */
  requestDelete(user: AdminUser) {
    void this.router.navigate([], {
      queryParams: { delete: user.id, created: null, reset: null },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Dismiss without deleting. Clearing `?delete` from the URL is what closes
   * the modal — the subscription reconciles `deleteUserId` back to null.
   */
  closeDeleteModal() {
    void this.router.navigate([], {
      queryParams: { delete: null },
      queryParamsHandling: 'merge',
    });
  }

  /**
   * Hard-delete the user behind `?delete=<id>` (audited server-side as
   * `user.delete`). The firm/org and its documents are kept — documents just
   * lose their owner. On success we refresh the list and clear both `?delete`
   * and any open detail panel, since that user no longer exists.
   */
  async confirmDelete() {
    const id = this.deleteUserId();
    if (!id || this.deleting()) return;
    const label = this.deleteUser()?.email ?? '';
    this.deleting.set(true);
    try {
      await this.adminApi.deleteUser(id);
      await this.refreshUsers();
      this.selectedUser.set(null);
      this.showCreate.set(false);
      this.toast.show(
        label ? `Deleted user ${label}` : 'User deleted',
        'success',
      );
      void this.router.navigate([], {
        queryParams: { delete: null, userId: null, action: null },
        queryParamsHandling: 'merge',
      });
    } catch (err: any) {
      this.toast.show(
        `Failed to delete user: ${err?.message ?? err}`,
        'error',
      );
    } finally {
      this.deleting.set(false);
    }
  }

  /**
   * Provision a new account. Re-validated and audited server-side. On success
   * the list refreshes and the just-generated temporary password is captured
   * into a signal, then we deep-link to `?created=<id>` to open the reveal
   * modal (the password stays out of the URL — signal only).
   */
  async createUser(value: CreateUserFormValue) {
    this.saving.set(true);
    try {
      const created = await this.adminApi.createUser({
        name: value.name,
        email: value.email,
        role: value.role,
        firmId: value.role === 'ADMIN' ? null : value.firmId,
      });
      await this.refreshUsers();
      // Stash the transient one-time password, then open the reveal modal as a
      // deep-linkable state (close the create panel via the merged params).
      this.temporaryPassword.set(created.temporaryPassword ?? null);
      this.selectedUser.set(null);
      this.showCreate.set(false);
      void this.router.navigate([], {
        queryParams: { created: created.id, action: null, userId: null, reset: null },
        queryParamsHandling: 'merge',
      });
    } catch (err: any) {
      alert(`Failed to create user: ${err?.message ?? err}`);
    } finally {
      this.saving.set(false);
    }
  }

  // ----- sorting -----

  sortTable(field: string) {
    if (this.sortState.field === field) {
      this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortState.field = field;
      this.sortState.direction = 'asc';
    }
    this.users.update(list => this.sortArray([...list], this.sortState.field, this.sortState.direction));
  }

  private sortArray(arr: AdminUser[], field: string, direction: 'asc' | 'desc'): AdminUser[] {
    return arr.sort((a: any, b: any) => {
      const valA = a[field] ?? '';
      const valB = b[field] ?? '';
      if (typeof valA === 'string' && typeof valB === 'string') {
        const c = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
        return direction === 'asc' ? c : -c;
      }
      return valA < valB ? (direction === 'asc' ? -1 : 1) : valA > valB ? (direction === 'asc' ? 1 : -1) : 0;
    });
  }
}
