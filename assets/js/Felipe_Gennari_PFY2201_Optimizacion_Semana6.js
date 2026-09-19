/* ============================================================
   Gaming House — JavaScript Semana 6
   Actividad Sumativa: Optimizando la lógica y rendimiento
   de una página web con JavaScript.
   Autor: Felipe Gennari — PFY2201 Desarrollo Frontend I

   Contenido del script:
   - Carga del catálogo desde un JSON LOCAL (assets/data/productos.json)
     usando la Fetch API, con timeout, reintentos y validación de datos.
   - Renderizado dinámico de las tarjetas de producto en el DOM.
   - Menú de categorías generado dinámicamente desde el JSON.
   - Carrito de compras con resumen y total actualizado (evento click).
   - Búsqueda de productos sin recargar la página (evento submit).
   - Noticias desde API externa (JSONPlaceholder) con manejo de errores.
   - Mensajes amigables y accesibles en todos los estados (carga,
     éxito, vacío y error), con botón "Reintentar" ante fallos.
   ============================================================ */

// ---------- Configuración central ----------
// Cambiar textos, URLs o ids aquí no requiere tocar la lógica principal.
const CONFIG = {
    rutas: {
        // Archivo JSON local con el catálogo de productos.
        // IMPORTANTE: fetch() no funciona al abrir el HTML con doble clic
        // (protocolo file://). Hay que usar un servidor local (por ejemplo
        // la extensión "Live Server" de VS Code) o el despliegue en gh-pages.
        productosJson: 'assets/data/productos.json'
    },
    api: {
        url: 'https://jsonplaceholder.typicode.com/posts?_limit=3',
        timeoutMs: 8000,          // tiempo máximo de espera por intento
        reintentos: 2,            // reintentos adicionales ante fallos transitorios
        esperaEntreReintentosMs: 1000 // espera base; crece linealmente por intento
    },
    selectores: {
        contenedorProductos: 'contenedor-productos',
        estadoProductos: 'estado-productos',
        listaCategorias: 'lista-categorias',
        formBusqueda: 'form-busqueda',
        buscador: 'buscador',
        listaCarrito: 'lista-carrito',
        totalCarrito: 'total-carrito',
        estadoApi: 'estado-api',
        listaNoticias: 'lista-noticias',
        mensaje: 'mensaje-interaccion',
        sinResultados: 'sin-resultados'
    },
    textos: {
        inicio: 'Interactividad cargada: busca productos, filtra por categoría o agrega items al carrito.',
        cargandoProductos: 'Cargando catálogo de productos... ',
        productosCargados: (cantidad) => `Catálogo cargado desde JSON local: ${cantidad} producto(s) disponibles.`,
        errorProductos: 'No se pudo cargar el catálogo de productos. Revisa tu conexión e intenta nuevamente. ',
        errorJsonVacio: 'El archivo JSON no contiene productos válidos.',
        cargandoNoticias: 'Cargando noticias desde la API... ',
        noticiasCargadas: 'Noticias cargadas correctamente.',
        noticiasVacias: 'No hay noticias disponibles por el momento.',
        errorNoticias: 'No se pudieron cargar las noticias. Revisa tu conexión e intenta nuevamente. ',
        reintentar: 'Reintentar',
        reintentando: 'Reintentando...',
        busquedaVacia: 'Mostrando todos los productos disponibles.',
        categoriaTodas: 'Mostrando todas las categorías.',
        categoriaFiltrada: (categoria) => `Mostrando la categoría "${categoria}".`,
        productoAgregado: (nombre) => `${nombre} agregado al carrito.`,
        busquedaConResultados: (cantidad, termino) => `Se encontraron ${cantidad} producto(s) para "${termino}".`,
        busquedaSinResultados: (termino) => `No se encontraron productos para "${termino}".`
    }
};

// Referencias DOM cacheadas una sola vez en cachearSelectores().
const dom = {};

// Estado de la aplicación: catálogo cargado desde el JSON local,
// categoría seleccionada en la navbar y contenido del carrito.
const estado = {
    productos: [],
    categoria: 'todas'
};
const carrito = [];

// Punto de entrada: espera a que el DOM esté listo antes de manipularlo.
document.addEventListener('DOMContentLoaded', inicializarAplicacion);

/**
 * Inicializa la aplicación cacheando selectores, configurando eventos
 * y cargando los datos (catálogo local y noticias externas).
 */
function inicializarAplicacion() {
    cachearSelectores();
    configurarEventos();
    cargarProductosJSON();
    cargarNoticiasAPI();
    actualizarTotalCarrito();
    mostrarMensaje(CONFIG.textos.inicio, 'info');
}

/**
 * Resuelve y guarda todas las referencias del DOM declaradas en
 * CONFIG.selectores, evitando llamadas repetidas a getElementById
 * durante la ejecución.
 */
function cachearSelectores() {
    Object.entries(CONFIG.selectores).forEach(([clave, id]) => {
        dom[clave] = document.getElementById(id);
    });
}

/**
 * Configura los eventos principales de la página.
 * Usa delegación de eventos sobre el contenedor de productos (los botones
 * se crean dinámicamente, por eso no se puede escuchar cada botón por
 * separado), el menú de categorías y el formulario de búsqueda.
 */
function configurarEventos() {
    if (dom.contenedorProductos) {
        dom.contenedorProductos.addEventListener('click', manejarClickCarrito);
        dom.contenedorProductos.addEventListener('mouseover', resaltarTarjeta);
        dom.contenedorProductos.addEventListener('mouseout', quitarResaltadoTarjeta);
    }

    if (dom.listaCategorias) {
        dom.listaCategorias.addEventListener('click', manejarFiltroCategoria);
    }

    if (dom.formBusqueda) {
        dom.formBusqueda.addEventListener('submit', manejarBusqueda);
    }
}

/* ============================================================
   Utilitarios reutilizables
   ============================================================ */

/**
 * Crea un elemento HTML con clases y texto opcionales.
 * Usa textContent, por lo que el texto nunca se interpreta como HTML.
 * @param {string} etiqueta Nombre de la etiqueta a crear.
 * @param {string[]} clases Clases CSS a aplicar.
 * @param {string} texto Contenido de texto del elemento.
 * @returns {HTMLElement} Elemento listo para insertar en el DOM.
 */
function crearElemento(etiqueta, clases = [], texto = '') {
    const elemento = document.createElement(etiqueta);

    if (clases.length > 0) {
        elemento.classList.add(...clases);
    }

    if (texto !== '') {
        elemento.textContent = texto;
    }

    return elemento;
}

/**
 * Crea una tarjeta reutilizable con título y texto (usada por las
 * noticias de la API y extensible a otros contenidos dinámicos).
 * @param {{titulo: string, texto: string, clasesExtra?: string[]}} opciones
 * @returns {HTMLElement} Artículo con la estructura de tarjeta.
 */
function crearTarjeta({ titulo, texto, clasesExtra = [] }) {
    const articulo = crearElemento('article', ['card', 'card-producto', 'h-100', ...clasesExtra]);
    const cuerpo = crearElemento('div', ['card-body']);
    const tituloEl = crearElemento('h3', ['card-title', 'fs-5'], titulo);
    const textoEl = crearElemento('p', ['card-text'], texto);

    cuerpo.appendChild(tituloEl);
    cuerpo.appendChild(textoEl);
    articulo.appendChild(cuerpo);

    return articulo;
}

/**
 * Crea la columna con la tarjeta completa de un producto del catálogo:
 * imagen, nombre, descripción con precio destacado y botón
 * "Agregar al carrito" con los datos en atributos data-*.
 * @param {{nombre: string, descripcion: string, precio: number, imagen: string, alt: string}} producto
 * @returns {HTMLElement} Columna de Bootstrap lista para el grid.
 */
function crearTarjetaProducto(producto) {
    const columna = crearElemento('div', ['col-12', 'col-md-6', 'col-lg-4']);
    const articulo = crearElemento('article', ['card', 'card-producto', 'h-100']);

    // Imagen del producto con carga diferida y texto alternativo del JSON.
    const imagen = crearElemento('img', ['card-img-top']);
    imagen.src = producto.imagen;
    imagen.alt = producto.alt;
    imagen.loading = 'lazy';

    const cuerpo = crearElemento('div', ['card-body', 'd-flex', 'flex-column']);
    const titulo = crearElemento('h3', ['card-title', 'fs-5'], producto.nombre);

    // Descripción con el precio dentro de un <span> destacado.
    const descripcion = crearElemento('p', ['card-text'], `${producto.descripcion} Precio: `);
    descripcion.appendChild(crearElemento('span', ['precio'], formatearPrecio(producto.precio)));

    // Botón con data-nombre y data-precio: el manejador del carrito los lee
    // por delegación de eventos al hacer click.
    const boton = crearElemento('button', ['btn', 'btn-gamer', 'mt-auto', 'btn-agregar'], 'Agregar al carrito');
    boton.type = 'button';
    boton.dataset.nombre = producto.nombre;
    boton.dataset.precio = String(producto.precio);

    cuerpo.appendChild(titulo);
    cuerpo.appendChild(descripcion);
    cuerpo.appendChild(boton);
    articulo.appendChild(imagen);
    articulo.appendChild(cuerpo);
    columna.appendChild(articulo);

    return columna;
}

/**
 * Pone en mayúscula la primera letra de un texto (para mostrar
 * las categorías en el menú y en los mensajes).
 * @param {string} texto Texto a transformar.
 * @returns {string} Texto con la primera letra en mayúscula.
 */
function capitalizar(texto) {
    return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/* ============================================================
   Catálogo de productos desde JSON local (Fetch API)
   ============================================================ */

/**
 * Carga el catálogo de productos desde el archivo JSON local usando
 * el wrapper fetchConReintentos. Gestiona los estados visibles de
 * carga, éxito y error con mensajes amigables.
 */
async function cargarProductosJSON() {
    if (!dom.contenedorProductos || !dom.estadoProductos) {
        return;
    }

    mostrarEstadoCargaProductos();

    try {
        const datos = await fetchConReintentos(CONFIG.rutas.productosJson);
        estado.productos = validarProductos(datos);

        // Si el JSON cargó pero no trae productos válidos, se trata
        // como error para mostrar el mensaje amigable correspondiente.
        if (estado.productos.length === 0) {
            throw new Error(CONFIG.textos.errorJsonVacio);
        }

        dom.estadoProductos.textContent = CONFIG.textos.productosCargados(estado.productos.length);
        dom.contenedorProductos.setAttribute('aria-busy', 'false');

        renderizarCategorias();
        aplicarFiltros();
    } catch (error) {
        console.error('Error al cargar productos:', error);
        mostrarErrorProductos();
    }
}

/**
 * Muestra el estado de carga del catálogo: spinner accesible y
 * aria-busy en el contenedor de productos.
 */
function mostrarEstadoCargaProductos() {
    dom.estadoProductos.textContent = CONFIG.textos.cargandoProductos;

    // Spinner de Bootstrap, oculto a lectores de pantalla porque el texto
    // del párrafo (role="status") ya anuncia el estado de carga.
    const spinner = crearElemento('span', ['spinner-border', 'spinner-border-sm']);
    spinner.setAttribute('aria-hidden', 'true');
    dom.estadoProductos.appendChild(spinner);

    dom.contenedorProductos.setAttribute('aria-busy', 'true');
    dom.contenedorProductos.innerHTML = '';
}

/**
 * Valida y normaliza los productos recibidos desde el JSON local antes
 * de insertarlos en el DOM: descarta entradas malformadas y limpia los
 * textos. El contenido se inserta siempre con textContent, por lo que
 * nunca se interpreta como HTML.
 * @param {any} datos Respuesta JSON cruda del archivo local.
 * @returns {{nombre: string, descripcion: string, precio: number, imagen: string, alt: string, categoria: string}[]}
 */
function validarProductos(datos) {
    if (!Array.isArray(datos)) {
        return [];
    }

    return datos
        .filter((producto) => producto
            && typeof producto.nombre === 'string'
            && typeof producto.descripcion === 'string'
            && typeof producto.imagen === 'string'
            && typeof producto.categoria === 'string'
            && Number.isFinite(Number(producto.precio)))
        .map((producto) => ({
            nombre: producto.nombre.trim(),
            descripcion: producto.descripcion.trim(),
            precio: Number(producto.precio),
            imagen: producto.imagen.trim(),
            alt: typeof producto.alt === 'string' && producto.alt.trim() !== ''
                ? producto.alt.trim()
                : `Imagen de ${producto.nombre.trim()}`,
            categoria: producto.categoria.trim().toLowerCase()
        }))
        .filter((producto) => producto.nombre !== '' && producto.imagen !== '');
}

/**
 * Genera dinámicamente las opciones del menú "Categorías" de la navbar
 * a partir de las categorías presentes en el JSON cargado, garantizando
 * así al menos dos categorías simuladas y funcionales.
 */
function renderizarCategorias() {
    if (!dom.listaCategorias) {
        return;
    }

    const categorias = [...new Set(estado.productos.map((producto) => producto.categoria))];
    dom.listaCategorias.innerHTML = '';

    ['todas', ...categorias].forEach((categoria) => {
        const item = crearElemento('li');
        const enlace = crearElemento(
            'a',
            ['dropdown-item', 'filtro-categoria'],
            categoria === 'todas' ? 'Todas' : capitalizar(categoria)
        );

        enlace.href = '#productos';
        enlace.dataset.categoria = categoria;
        item.appendChild(enlace);
        dom.listaCategorias.appendChild(item);
    });
}

/**
 * Filtra el catálogo según la categoría seleccionada y vuelve a
 * renderizar las tarjetas de producto en el DOM.
 */
function aplicarFiltros() {
    const filtrados = estado.categoria === 'todas'
        ? estado.productos
        : estado.productos.filter((producto) => producto.categoria === estado.categoria);

    renderizarProductos(filtrados);
}

/**
 * Inserta en el DOM las tarjetas de los productos indicados y actualiza
 * el aviso de "sin resultados" cuando la lista queda vacía.
 * @param {Array} productos Productos a renderizar.
 */
function renderizarProductos(productos) {
    dom.contenedorProductos.innerHTML = '';

    productos.forEach((producto) => {
        dom.contenedorProductos.appendChild(crearTarjetaProducto(producto));
    });

    if (dom.sinResultados) {
        dom.sinResultados.classList.toggle('d-none', productos.length > 0);
    }
}

/**
 * Muestra el estado de error del catálogo con un mensaje amigable y un
 * botón "Reintentar" accesible. El botón se deshabilita mientras el
 * reintento está en curso para evitar solicitudes duplicadas.
 */
function mostrarErrorProductos() {
    dom.contenedorProductos.setAttribute('aria-busy', 'false');
    dom.contenedorProductos.innerHTML = '';
    dom.estadoProductos.textContent = CONFIG.textos.errorProductos;

    const botonReintentar = crearElemento('button', ['btn', 'btn-gamer', 'btn-sm'], CONFIG.textos.reintentar);
    botonReintentar.type = 'button';
    botonReintentar.addEventListener('click', () => {
        botonReintentar.disabled = true;
        botonReintentar.textContent = CONFIG.textos.reintentando;
        cargarProductosJSON();
    });

    dom.estadoProductos.appendChild(botonReintentar);
    mostrarMensaje(CONFIG.textos.errorProductos, 'error');
}

/**
 * Maneja el click sobre una opción del menú "Categorías": actualiza el
 * estado, limpia el buscador y vuelve a renderizar el catálogo.
 * @param {MouseEvent} evento Evento click capturado por delegación.
 */
function manejarFiltroCategoria(evento) {
    const enlace = evento.target.closest('.filtro-categoria');

    if (!enlace) {
        return;
    }

    evento.preventDefault();
    estado.categoria = enlace.dataset.categoria;

    if (dom.buscador) {
        dom.buscador.value = '';
    }

    aplicarFiltros();

    if (estado.categoria === 'todas') {
        mostrarMensaje(CONFIG.textos.categoriaTodas, 'info');
    } else {
        mostrarMensaje(CONFIG.textos.categoriaFiltrada(capitalizar(estado.categoria)), 'info');
    }

    // Lleva la vista hasta la sección de productos tras filtrar.
    const seccionProductos = document.getElementById('productos');
    if (seccionProductos) {
        seccionProductos.scrollIntoView({ behavior: 'smooth' });
    }
}

/* ============================================================
   Carrito
   ============================================================ */

/**
 * Maneja el evento click de los botones "Agregar al carrito".
 * @param {MouseEvent} evento Evento click capturado por delegación.
 */
function manejarClickCarrito(evento) {
    const boton = evento.target.closest('.btn-agregar');

    if (!boton) {
        return;
    }

    const producto = {
        nombre: boton.dataset.nombre,
        precio: Number(boton.dataset.precio)
    };

    agregarProductoAlCarrito(producto);
    mostrarMensaje(CONFIG.textos.productoAgregado(producto.nombre), 'exito');
}

/**
 * Agrega un producto al carrito usando la utilidad crearElemento.
 * @param {{nombre: string, precio: number}} producto Producto seleccionado.
 */
function agregarProductoAlCarrito(producto) {
    if (!dom.listaCarrito) {
        return;
    }

    // Si es el primer producto, se limpia el mensaje de carrito vacío.
    if (carrito.length === 0) {
        dom.listaCarrito.innerHTML = '';
    }

    carrito.push(producto);

    const itemCarrito = crearElemento(
        'li',
        ['list-group-item', 'item-carrito'],
        `${producto.nombre} - ${formatearPrecio(producto.precio)}`
    );

    dom.listaCarrito.appendChild(itemCarrito);
    actualizarTotalCarrito();
}

/**
 * Recalcula y muestra el total actual del carrito.
 */
function actualizarTotalCarrito() {
    const total = carrito.reduce((acumulado, producto) => acumulado + producto.precio, 0);

    if (dom.totalCarrito) {
        dom.totalCarrito.textContent = `Total: ${formatearPrecio(total)}`;
    }
}

/**
 * Formatea un número como precio en pesos chilenos.
 * @param {number} valor Valor numérico del precio.
 * @returns {string} Precio formateado para mostrar en pantalla.
 */
function formatearPrecio(valor) {
    return `$${valor.toLocaleString('es-CL')} CLP`;
}

/* ============================================================
   Resaltado de tarjetas (mouseover / mouseout)
   ============================================================ */

/**
 * Resalta visualmente una tarjeta cuando el mouse pasa sobre ella.
 * @param {MouseEvent} evento Evento mouseover capturado por delegación.
 */
function resaltarTarjeta(evento) {
    const tarjeta = evento.target.closest('.card-producto');

    if (tarjeta) {
        tarjeta.classList.add('card-resaltada');
    }
}

/**
 * Quita el resaltado solo cuando el mouse sale completamente de la tarjeta.
 * @param {MouseEvent} evento Evento mouseout capturado por delegación.
 */
function quitarResaltadoTarjeta(evento) {
    const tarjeta = evento.target.closest('.card-producto');

    if (tarjeta && !tarjeta.contains(evento.relatedTarget)) {
        tarjeta.classList.remove('card-resaltada');
    }
}

/* ============================================================
   Búsqueda de productos
   ============================================================ */

/**
 * Maneja el submit del buscador evitando la recarga de la página.
 * Filtra las tarjetas de productos según el texto ingresado y muestra
 * un estado visible cuando no hay coincidencias.
 * @param {SubmitEvent} evento Evento submit del formulario de búsqueda.
 */
function manejarBusqueda(evento) {
    evento.preventDefault();

    const termino = dom.buscador ? dom.buscador.value.trim().toLowerCase() : '';
    const tarjetas = dom.contenedorProductos
        ? dom.contenedorProductos.querySelectorAll('.card-producto')
        : [];
    let productosVisibles = 0;

    tarjetas.forEach((tarjeta) => {
        const columna = tarjeta.closest('.col-12');
        const textoTarjeta = tarjeta.textContent.toLowerCase();
        const coincide = textoTarjeta.includes(termino);

        if (columna) {
            columna.classList.toggle('d-none', !coincide);
        }

        if (coincide) {
            productosVisibles += 1;
        }
    });

    // Estado vacío visible dentro de la sección de productos.
    if (dom.sinResultados) {
        dom.sinResultados.classList.toggle('d-none', termino === '' || productosVisibles > 0);
    }

    if (termino === '') {
        mostrarMensaje(CONFIG.textos.busquedaVacia, 'info');
    } else if (productosVisibles > 0) {
        mostrarMensaje(CONFIG.textos.busquedaConResultados(productosVisibles, termino), 'exito');
    } else {
        mostrarMensaje(CONFIG.textos.busquedaSinResultados(termino), 'error');
    }
}

/* ============================================================
   Fetch API con timeout, reintentos y validación de datos
   ============================================================ */

/**
 * Devuelve una promesa que se resuelve después de los ms indicados.
 * @param {number} ms Milisegundos de espera.
 * @returns {Promise<void>}
 */
function esperar(ms) {
    return new Promise((resolver) => setTimeout(resolver, ms));
}

/**
 * Wrapper de Fetch con timeout (AbortController) y reintentos ante
 * fallos transitorios de red. Comprueba response.ok antes de aceptar
 * la respuesta y la espera entre reintentos crece por intento.
 * @param {string} url URL del recurso a solicitar.
 * @returns {Promise<any>} Cuerpo de la respuesta parseado como JSON.
 * @throws {Error} Si todos los intentos fallan o la respuesta no es ok.
 */
async function fetchConReintentos(url) {
    const { timeoutMs, reintentos, esperaEntreReintentosMs } = CONFIG.api;
    let ultimoError = null;

    for (let intento = 0; intento <= reintentos; intento++) {
        const controlador = new AbortController();
        const temporizador = setTimeout(() => controlador.abort(), timeoutMs);

        try {
            const respuesta = await fetch(url, { signal: controlador.signal });

            if (!respuesta.ok) {
                throw new Error(`Error HTTP: ${respuesta.status}`);
            }

            return await respuesta.json();
        } catch (error) {
            // AbortError = timeout; cualquier otro error = fallo de red o HTTP.
            ultimoError = error;

            if (intento < reintentos) {
                await esperar(esperaEntreReintentosMs * (intento + 1));
            }
        } finally {
            clearTimeout(temporizador);
        }
    }

    throw ultimoError;
}

/* ============================================================
   Noticias desde API externa (JSONPlaceholder)
   ============================================================ */

/**
 * Carga noticias desde la API pública usando el wrapper con reintentos.
 * Gestiona los estados visibles de carga, éxito, vacío y error.
 */
async function cargarNoticiasAPI() {
    if (!dom.estadoApi || !dom.listaNoticias) {
        return;
    }

    mostrarEstadoCargaAPI();

    try {
        const datos = await fetchConReintentos(CONFIG.api.url);
        const noticias = validarNoticias(datos);
        mostrarNoticiasAPI(noticias);
    } catch (error) {
        console.error('Error al cargar noticias:', error);
        mostrarErrorAPI();
    }
}

/**
 * Muestra el estado de carga: spinner accesible y aria-busy en la lista.
 */
function mostrarEstadoCargaAPI() {
    dom.estadoApi.textContent = CONFIG.textos.cargandoNoticias;

    // Spinner de Bootstrap, oculto a lectores de pantalla porque el texto
    // del párrafo (role="status") ya anuncia el estado de carga.
    const spinner = crearElemento('span', ['spinner-border', 'spinner-border-sm']);
    spinner.setAttribute('aria-hidden', 'true');
    dom.estadoApi.appendChild(spinner);

    dom.listaNoticias.setAttribute('aria-busy', 'true');
    dom.listaNoticias.innerHTML = '';
}

/**
 * Valida y normaliza los datos recibidos desde la API antes de
 * insertarlos en el DOM: descarta entradas malformadas y limpia
 * los textos. El contenido se inserta siempre con textContent,
 * por lo que nunca se interpreta como HTML.
 * @param {any} datos Respuesta JSON cruda de la API.
 * @returns {{title: string, body: string}[]} Lista de noticias válidas.
 */
function validarNoticias(datos) {
    if (!Array.isArray(datos)) {
        return [];
    }

    return datos
        .filter((noticia) => noticia
            && typeof noticia.title === 'string'
            && typeof noticia.body === 'string')
        .map((noticia) => ({
            title: noticia.title.trim(),
            body: noticia.body.trim()
        }))
        .filter((noticia) => noticia.title !== '' && noticia.body !== '');
}

/**
 * Renderiza las noticias validadas o el estado vacío si no hay ninguna.
 * @param {{title: string, body: string}[]} noticias Noticias válidas.
 */
function mostrarNoticiasAPI(noticias) {
    dom.listaNoticias.setAttribute('aria-busy', 'false');
    dom.listaNoticias.innerHTML = '';

    if (noticias.length === 0) {
        dom.estadoApi.textContent = CONFIG.textos.noticiasVacias;
        return;
    }

    dom.estadoApi.textContent = CONFIG.textos.noticiasCargadas;

    noticias.forEach((noticia) => {
        const columna = crearElemento('div', ['col-12', 'col-md-4']);

        columna.appendChild(crearTarjeta({
            titulo: noticia.title,
            texto: noticia.body,
            clasesExtra: ['noticia-api']
        }));

        dom.listaNoticias.appendChild(columna);
    });
}

/**
 * Muestra el estado de error con un botón "Reintentar" accesible.
 * El botón se deshabilita mientras el reintento está en curso para
 * evitar solicitudes duplicadas.
 */
function mostrarErrorAPI() {
    dom.listaNoticias.setAttribute('aria-busy', 'false');
    dom.estadoApi.textContent = CONFIG.textos.errorNoticias;

    const botonReintentar = crearElemento('button', ['btn', 'btn-gamer', 'btn-sm'], CONFIG.textos.reintentar);
    botonReintentar.type = 'button';
    botonReintentar.addEventListener('click', () => {
        botonReintentar.disabled = true;
        botonReintentar.textContent = CONFIG.textos.reintentando;
        cargarNoticiasAPI();
    });

    dom.estadoApi.appendChild(botonReintentar);
    mostrarMensaje(CONFIG.textos.errorNoticias, 'error');
}

/* ============================================================
   Mensajes dinámicos
   ============================================================ */

/**
 * Muestra mensajes dinámicos accesibles para el usuario.
 * @param {string} texto Mensaje a mostrar.
 * @param {'info'|'exito'|'error'} tipo Tipo visual del mensaje.
 */
function mostrarMensaje(texto, tipo = 'info') {
    if (!dom.mensaje) {
        return;
    }

    dom.mensaje.textContent = texto;
    dom.mensaje.className = `mensaje-interaccion mensaje-${tipo}`;
}
