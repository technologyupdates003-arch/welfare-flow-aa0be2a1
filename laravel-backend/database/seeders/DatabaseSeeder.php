<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $path = database_path('sql/seed.sql');
        if (! is_file($path)) {
            throw new RuntimeException("Seed file not found: {$path}");
        }

        DB::unprepared(file_get_contents($path));

        $this->command?->info('Welfare baseline data seeded.');
    }
}
