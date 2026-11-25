# Idol Mixes

Una pequeña biblioteca web para guardar idol calls y mixes, con nombre y lectura en romaji y kana.

## Usar en local

No usa SQL ni paquetes de npm. Hace falta tener Node.js instalado para guardar automáticamente en el archivo JSON. Desde esta carpeta, inicia el servidor local:

```sh
node server.js
```

Abre [http://localhost:8000](http://localhost:8000) en el navegador. Cada cambio se escribe en `data/mixes.json`.

## Datos y GitHub Pages

`data/mixes.json` es la única fuente de la colección. En local, la app la lee y escribe cada alta, edición, eliminación e importación a través del servidor Node. La colección no se guarda en `localStorage`.

GitHub Pages publica una versión de solo lectura que carga `data/mixes.json`. Para cambiar los mixes, inicia `node server.js`, edítalos en `http://localhost:8000` y sube el `data/mixes.json` actualizado al repositorio. GitHub Pages mostrará los cambios después de publicar el commit.

**Exportar** permite descargar una copia JSON. **Importar** está disponible al usar el servidor local y reemplaza la colección del archivo.

## Funciones

- Buscar en los nombres y las lecturas, tanto en romaji como en kana.
- Añadir varias versiones dentro de un mix, cada una con subtítulo y lectura propia; también puedes cambiar el nombre de la versión principal.
- Guardar un inicio opcional (始動) en romaji y kana.
- Guardar una o varias duraciones en compases (小節) y filtrar por ellas.
- Filtrar compases y etiquetas con clics sucesivos: incluir, excluir y quitar el filtro.
- Etiquetar y filtrar por Kahen Sanren (可変三連), Konton (混沌), Koujou (口上) y Gengo (言語).
- Cambiar el idioma visible de los nombres.
- Desplegar cada mix para ver su lectura en romaji y kana.
- Añadir, editar y eliminar entradas.
- Elegir tema claro u oscuro.
