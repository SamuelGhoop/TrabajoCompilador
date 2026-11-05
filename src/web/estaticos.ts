// Módulo estaticos decide qué archivo sirve el servidor para una ruta del
// modo 3D. Solo hay dos carpetas públicas:
//
//	/3d/...        → web/3d/            (el visor 3D y los modelos .glb)
//	/vendor/three/ → node_modules/three/ (la librería three.js)
//
// Cualquier otra ruta, o una que intente salir de su carpeta con "..", no
// sirve nada.
import { posix } from "node:path";

const CARPETAS: Record<string, string> = {
	"/3d/": "web/3d/",
	"/vendor/three/": "node_modules/three/",
};

const TIPOS: Record<string, string> = {
	".js": "text/javascript",
	".glb": "model/gltf-binary",
	".json": "application/json",
	".png": "image/png",
};

export interface Estatico {
	ruta: string; // relativa a la raíz del proyecto
	tipo: string;
}

// rutaEstatica traduce la URL de un pedido a un archivo del proyecto, o null
// si no es pública.
export function rutaEstatica(url: string): Estatico | null {
	let camino: string;
	try {
		camino = decodeURIComponent(new URL(url, "http://x").pathname);
	} catch {
		return null;
	}
	for (const [prefijo, carpeta] of Object.entries(CARPETAS)) {
		if (!camino.startsWith(prefijo)) {
			continue;
		}
		const resto = posix.normalize(camino.slice(prefijo.length));
		if (resto.startsWith("..") || resto.startsWith("/") || resto.includes("\\") || resto.includes("\0")) {
			return null;
		}
		const tipo = TIPOS[posix.extname(resto)];
		return tipo === undefined ? null : { ruta: carpeta + resto, tipo };
	}
	return null;
}
