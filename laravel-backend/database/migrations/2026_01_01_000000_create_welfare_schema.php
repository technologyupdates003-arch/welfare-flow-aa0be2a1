<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Creates the full KHCWW welfare schema (66 tables) from database/sql/schema.sql.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->runSqlFile(database_path('sql/schema.sql'));
    }

    public function down(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS = 0');

        $tables = DB::select('SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()');
        foreach ($tables as $row) {
            $name = (array) $row;
            $table = (string) ($name['t'] ?? $name['T'] ?? '');
            if ($table !== '' && $table !== 'migrations') {
                DB::statement(sprintf('DROP TABLE IF EXISTS `%s`', $table));
            }
        }

        DB::statement('SET FOREIGN_KEY_CHECKS = 1');
    }

    private function runSqlFile(string $path): void
    {
        if (! is_file($path)) {
            throw new RuntimeException("SQL file not found: {$path}");
        }

        DB::unprepared(file_get_contents($path));
    }
};
