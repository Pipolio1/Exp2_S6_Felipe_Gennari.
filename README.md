# Gaming House — Exp2_S6_Felipe_Gennari

Actividad Sumativa Semana 6 — **Optimizando la lógica y rendimiento de una página web con JavaScript**
Curso: Desarrollo Frontend I (PFY2201) — Duoc UC
Autor: Felipe Gennari

## Descripción

Sitio web de eCommerce "Gaming House" (tienda de videojuegos) construido con **Bootstrap 5.3** y **JavaScript**. El catálogo de productos se carga dinámicamente desde un **archivo JSON local** mediante la **Fetch API** y se renderiza en el DOM con manipulación de elementos.

## Funcionalidades

- **Catálogo dinámico**: los productos se cargan con Fetch API desde `assets/data/productos.json` y se muestran como tarjetas (cards) de Bootstrap con imagen, nombre, descripción y precio.
- **Filtro por categorías**: menú desplegable en la barra de navegación (Consolas, Videojuegos, Accesorios) generado dinámicamente desde el JSON.
- **Carrito de compras**: evento `click` en "Agregar al carrito" que añade productos al resumen y actualiza el total en tiempo real.
- **Búsqueda**: evento `submit` del formulario que filtra productos sin recargar la página, con aviso cuando no hay resultados.
- **Noticias desde API externa**: sección de novedades cargada con Fetch API desde JSONPlaceholder.
- **Manejo de errores**: mensajes amigables, spinner de carga y botón "Reintentar" ante fallos de carga (timeout con AbortController y reintentos).
- **Accesibilidad y responsividad**: diseño adaptable a móviles, tablets y escritorio; atributos ARIA, foco visible y textos alternativos.

## Estructura del proyecto

```
├── index.html
└── assets/
    ├── css/    # Hoja de estilos propia (tema gamer sobre Bootstrap 5)
    ├── js/     # Lógica JavaScript (DOM, eventos, Fetch API)
    ├── img/    # Logo e imágenes del carrusel (WebP)
    └── data/   # productos.json (catálogo local)
```

## Cómo ejecutar

El proyecto usa `fetch()` sobre un JSON local, por lo que **no funciona abriendo `index.html` con doble clic** (protocolo `file://`). Opciones:

- Extensión **Live Server** de VS Code: clic derecho en `index.html` → "Open with Live Server".
- O visitar el despliegue público en GitHub Pages.

## Tecnologías

- HTML5, CSS3 (variables CSS), JavaScript (ES6+)
- Bootstrap 5.3 (CDN)
- Fetch API, DOM, eventos (click, submit, mouseover/mouseout)
