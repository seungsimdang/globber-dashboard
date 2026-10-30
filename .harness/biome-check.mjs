// 사용법: node .harness/biome-check.mjs check [--write] [Biome 옵션·경로...]
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkStatementFiles } from './check-statement-spacing.mjs';

export function processedFiles(output) {
	// shortcut: Biome의 공개 --verbose 파일 목록 형식 사용. 형식이 바뀌면 조용히 생략하지 않고 실패한다.
	const unsupported = () => {
		throw new Error(
			'Biome 처리 파일 목록을 읽을 수 없습니다. --verbose 출력 형식을 확인하세요.'
		);
	};

	if (!output.includes('  i Files processed:\n')) unsupported();

	return [
		...new Set(
			[
				...output.matchAll(
					/  i Files (?:processed|fixed):\n([\s\S]*?)(?:\n\n|$)/g
				)
			].flatMap(match => {
				const lines = match[1].split('\n').filter(line => line.trim());

				if (!lines.length) unsupported();

				return lines.flatMap(line => {
					if (line === '  ! The list is empty.') return [];

					const file = line.match(/^  - (.+)$/);

					if (!file) unsupported();

					return [file[1]];
				});
			})
		)
	];
}

export function runBiome(args, root = process.cwd()) {
	if (
		!['check', 'lint', 'format', 'ci'].includes(args[0]) ||
		args.some(arg => /^--(?:reporter|stdin-file-path)(?:=|$)/.test(arg))
	)
		throw new Error(
			'check·lint·format·ci와 파일 경로를 사용하세요. reporter·stdin 모드는 지원하지 않습니다.'
		);

	const result = spawnSync(
		resolve(root, 'node_modules/.bin/biome'),
		[...args, '--verbose', '--colors=off'],
		{ cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
	);

	if (result.error) throw result.error;

	process.stdout.write(result.stdout);
	process.stderr.write(result.stderr);
	if (result.status !== 0) return result.status ?? 1;

	const files = processedFiles(result.stdout.replaceAll('\r\n', '\n'));

	const write = args.some(arg =>
		['--write', '--fix', '--write=true', '--fix=true'].includes(arg)
	);

	return checkStatementFiles(root, files, write) ? 0 : 1;
}

if (
	process.argv[1] &&
	realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		process.exitCode = runBiome(process.argv.slice(2));
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
