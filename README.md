# Idol Mixes

Una pequeña biblioteca web para guardar idol calls y mixes, con nombre y lectura en romaji y kana.

## Usar en local

No usa SQL ni paquetes de npm. Hace falta tener Node.js instalado para guardar automáticamente en el archivo JSON. Desde esta carpeta, inicia el servidor local:

```sh
node server.js
```

Abre [http://localhost:8000](http://localhost:8000) en el navegador. Cada cambio se escribe en `data/mixes.json`.

## Datos

La fuente principal es `data/mixes.json`, dentro del proyecto. **Exportar** y **Importar** permiten crear o recuperar copias JSON; importar reemplaza la colección abierta. Se migran automáticamente los mixes que hubiera en `localStorage` la primera vez que el servidor JSON se inicia desde ese navegador.

Si se abre una versión estática sin `server.js` (por ejemplo, desde GitHub Pages), la app vuelve a guardar los cambios en el `localStorage` de ese navegador. Esos cambios no se escriben en el archivo del proyecto.

## Funciones

- Buscar en los nombres y las lecturas, tanto en romaji como en kana.
- Guardar un inicio opcional (始動) en romaji y kana.
- Guardar una o varias duraciones en compases (小節) y filtrar por ellas.
- Etiquetar y filtrar por Kahen Sanren (可変三連), Konton (混沌), Koujou (口上) y Gengo (言語).
- Cambiar el idioma visible de los nombres.
- Desplegar cada mix para ver su lectura en romaji y kana.
- Añadir, editar y eliminar entradas.
- Elegir tema claro u oscuro.
