# Ruleta de nombres

Aplicación web estática para elegir un nombre al azar con una ruleta animada.
Hecha solo con HTML, CSS y JavaScript (módulos ES), sin dependencias ni paso de build.

## Funciones

- Agregar nombres uno a uno o pegando varios (uno por línea).
- Se ignoran líneas vacías y espacios sobrantes; se avisa de los duplicados.
- Ruleta dibujada en `<canvas>` con porciones iguales y colores distintos.
- Giro animado de 4 a 6 segundos con desaceleración suave.
- Modal con el ganador, confeti y opción de quitarlo de la lista.
- La lista se guarda en el navegador (`localStorage`).
- Diseño responsive, modo oscuro automático y navegación por teclado.

## Estructura

```
index.html
css/styles.css
js/app.js          # Interfaz y estado
js/wheel.js        # Dibujo y animación de la ruleta
js/picker.js       # Selección del resultado y cálculo de ángulos (funciones puras)
js/storage.js      # Persistencia en localStorage
js/confetti.js     # Confeti en canvas
js/prefs-panel.js  # Preferencias
```

## Uso local

Los módulos ES necesitan un servidor (no funcionan abriendo el archivo con `file://`):

```bash
python -m http.server 8000
# luego abre http://localhost:8000
```

## Despliegue

Publicado con GitHub Pages desde la rama `main`, carpeta raíz (`/`).
Todas las rutas son relativas, así que funciona bajo `https://<usuario>.github.io/<repo>/`.
