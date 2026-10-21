const esbuild = require('esbuild');

async function bundle() {
	await esbuild.build({
		entryPoints: ['dist/nodes/S3Presigner/S3Presigner.node.js'],
		bundle: true,
		platform: 'node',
		target: 'node18',
		outfile: 'dist/nodes/S3Presigner/S3Presigner.node.js',
		allowOverwrite: true,
		external: ['n8n-workflow'],
	});
}

bundle().catch((error) => {
	console.error(error);
	process.exit(1);
});
