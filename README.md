# Idol Mixes

Una pequeña biblioteca web para guardar idol calls y mixes, con nombre y lectura en romaji y kana.

## Usar en local

No usa SQL ni paquetes de npm. Hace falta tener Node.js instalado para guardar automáticamente en el archivo JSON. Desde esta carpeta, inicia el servidor local:

```sh
node server.js
```

Abre [http://localhost:8000](http://localhost:8000) en el navegador. Cada cambio se escribe en `data/mixes.json`.

## Datos

`data/mixes.json` es la única fuente de la colección: la app la lee al iniciarse y escribe ahí cada alta, edición, eliminación e importación. La colección no se guarda en `localStorage`. **Exportar** y **Importar** permiten crear o recuperar copias JSON; importar reemplaza la colección del archivo.

Para editar la colección, inicia `node server.js` y abre `http://localhost:8000`. Sin el servidor, la app no carga ni guarda mixes; los cambios no se guardan en el navegador como alternativa.

## Funciones

- Buscar en los nombres y las lecturas, tanto en romaji como en kana.
- Añadir varias versiones dentro de un mix, cada una con subtítulo y lectura propia; también puedes cambiar el nombre de la versión principal.
- Guardar un inicio opcional (始動) en romaji y kana.
- Guardar una o varias duraciones en compases (小節) y filtrar por ellas.
- Etiquetar y filtrar por Kahen Sanren (可変三連), Konton (混沌), Koujou (口上) y Gengo (言語).
- Cambiar el idioma visible de los nombres.
- Desplegar cada mix para ver su lectura en romaji y kana.
- Añadir, editar y eliminar entradas.
- Elegir tema claro u oscuro.
