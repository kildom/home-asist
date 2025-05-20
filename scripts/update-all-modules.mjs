import fs from 'node:fs';
import child_process from 'node:child_process';
import process from 'node:process';

/** @param  {...string} command */
function exec(...command) {
    if (process.platform.indexOf('win') >= 0) {
        command.unshift('cmd', '/c');
    }
    let res = child_process.spawnSync(command[0], command.slice(1), { stdio: 'inherit' });
    if (res.error) throw res.error;
    if (res.status !== 0) throw new Error(`Program status: ${res.status}`);
}

// Remove node_modules and package-lock.json
console.log('Removing files...');
try {
    fs.rmSync('node_modules', { recursive: true });
} catch (_) { /* ignore */ }
try {
    fs.unlinkSync('package-lock.json');
} catch (_) { /* ignore */ }

// Remove dependencies from package.json
console.log('Removing dependencies from package.json...');
let pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
let dependencies = Object.keys(pkg.dependencies);
let devDependencies = Object.keys(pkg.devDependencies);
delete pkg.dependencies;
delete pkg.devDependencies;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 4).replace(/\r?\n/g, '\n'));

// Install dependencies again
console.log('Installing dependencies:', ...dependencies, '...');
exec('npm', 'install', '--save', ...dependencies);
console.log('Installing development dependencies:', ...devDependencies, '...');
exec('npm', 'install', '--save-dev', ...devDependencies);

// Show audit results
console.log('Audit results');
exec('npm', 'audit');
