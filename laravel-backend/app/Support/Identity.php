<?php

declare(strict_types=1);

namespace App\Support;

/** Authenticated identity resolved from the bearer token. */
final class Identity
{
    public function __construct(
        public readonly ?string $userId = null,
        public readonly ?string $email = null,
        /** @var array<int,string> */
        public readonly array $roles = [],
        public readonly ?string $memberId = null
    ) {
    }

    public function isAuthenticated(): bool
    {
        return $this->userId !== null;
    }

    public function hasRole(string ...$roles): bool
    {
        foreach ($roles as $role) {
            if (in_array($role, $this->roles, true)) {
                return true;
            }
        }

        return false;
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole('super_admin');
    }

    public function isAdmin(): bool
    {
        return $this->hasRole('admin', 'super_admin');
    }

    public function isStaff(): bool
    {
        return $this->hasRole(
            'admin',
            'super_admin',
            'treasurer',
            'chairperson',
            'vice_chairperson',
            'secretary',
            'vice_secretary',
            'patron'
        );
    }
}
