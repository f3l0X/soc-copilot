# Cómo trabajar con `main` — guía para el equipo

> Para los 5 del grupo. Si nunca has tocado Git, lee de arriba a abajo. Si ya
> sabes, salta a la sección **Flujo diario**.

## ¿Por qué esta guía?

El proyecto se rompe si subimos un ZIP descomprimido en una rama nueva (eso
mete una carpeta `soc-copilot-main/` duplicada y crea un historial paralelo
que no se puede mergear). Para evitarlo, **siempre** trabajamos clonando el
repo y haciendo `branch` desde `main`.

---

## 0. Instalar Git (solo la primera vez)

- **Windows**: descarga [Git for Windows](https://git-scm.com/download/win) →
  instala con los valores por defecto.
- **macOS**: `brew install git` (o ya viene con Xcode).
- **Linux**: `sudo apt install git` / `sudo dnf install git`.

Comprueba que funciona:
```bash
git --version
```

Configura tu nombre y email (los que verás en los commits):
```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu-email@ejemplo.com"
```

> El email debería coincidir con tu cuenta de GitHub para que los commits te
> aparezcan asignados.

---

## 1. Clonar el repo (solo la primera vez)

Abre una terminal en la carpeta donde quieras tener el proyecto y ejecuta:

```bash
git clone https://github.com/<usuario>/soc-copilot.git
cd soc-copilot
```

**Nunca** descargues el ZIP de GitHub. Siempre `git clone`. El ZIP no incluye
el historial y no se puede sincronizar después.

---

## 2. Flujo diario

### a) Antes de empezar a trabajar: actualizar `main`

```bash
git checkout main          # me sitúo en main
git pull                   # bajo los cambios del equipo
```

### b) Crear una rama para tu trabajo

**Nunca commitees directo a `main`.** Crea una rama con un nombre descriptivo:

```bash
git checkout -b feat/dark-mode          # nueva feature
git checkout -b fix/login-bug           # arreglar un bug
git checkout -b docs/manual-usuario     # solo docs
```

Convención de nombres:
- `feat/...` para nuevas funcionalidades
- `fix/...` para bugs
- `docs/...` para documentación
- `chore/...` para tareas de mantenimiento

### c) Hacer cambios y commitear

Edita los archivos que necesites. Cuando termines un bloque pequeño y
coherente de cambios:

```bash
git status                 # qué he tocado
git diff                   # qué cambió exactamente
git add <archivo>          # stage de un archivo concreto
git add .                  # stage de todo lo modificado
git commit -m "feat: descripción corta de qué hice"
```

Buenos mensajes de commit:
- ✅ `feat(login): añadir validación de email en tiempo real`
- ✅ `fix(chat): corregir scroll automático al final`
- ❌ `cambios`
- ❌ `auto: cambios guardados` ← evita esto, el commit ya no dice nada

Commits pequeños y frecuentes son mejores que uno gigante al final.

### d) Subir tu rama a GitHub

La primera vez que pusheas una rama nueva:
```bash
git push -u origin feat/dark-mode
```

Las siguientes veces basta con:
```bash
git push
```

### e) Abrir un Pull Request (PR)

1. Ve a GitHub → la pestaña "Pull requests" → "New pull request"
2. Base: `main` ← Compare: `feat/dark-mode`
3. Pon un título descriptivo y un cuerpo con:
   - Qué cambia y por qué
   - Cómo probarlo (pasos manuales o tests)
   - Screenshots si es UI
4. Pide review a alguien del equipo
5. Cuando se apruebe → "Squash and merge" (deja `main` con commits limpios)

### f) Borrar la rama cuando esté mergeada

```bash
git checkout main
git pull
git branch -d feat/dark-mode             # borra local
git push origin --delete feat/dark-mode  # borra remoto (o desde GitHub UI)
```

---

## 3. Mantener tu rama al día con `main`

Si llevas días en tu rama y han mergeado cosas a `main`, antes de pedir review
trae los cambios:

```bash
git checkout main
git pull
git checkout feat/mi-rama
git merge main             # mete los últimos cambios de main en tu rama
```

Si hay conflictos, Git te avisa. Abre los archivos marcados, busca las marcas
`<<<<<<<`, `=======`, `>>>>>>>`, decide qué versión queda, guarda, y:
```bash
git add <archivo-resuelto>
git commit                 # confirma el merge
```

---

## 4. Errores típicos y cómo arreglarlos

### "He cambiado algo y quiero deshacerlo (todavía no commiteado)"
```bash
git checkout -- <archivo>          # descartar cambios de un archivo
git restore <archivo>              # equivalente moderno
```

### "He hecho commit con un mensaje feo"
```bash
git commit --amend -m "mensaje nuevo"
```
⚠️ Solo si **no** has pusheado todavía. Si ya pusheaste, deja el feo y aprende.

### "Estoy en main y tengo cambios sin commitear que no quería ahí"
```bash
git stash                          # los guarda aparte
git checkout -b feat/mi-rama       # crea rama
git stash pop                      # los recupera en la rama
```

### "He pulleado y me sale un mensaje raro de merge"
```bash
git pull --rebase                  # rebase en vez de merge cuando haces pull
```
Configura esto por defecto:
```bash
git config --global pull.rebase true
```

### "Quiero ver qué hay en el repo remoto sin descargar"
- Mira en GitHub directamente
- O `git fetch && git log --oneline --all` para ver todas las ramas

---

## 5. Lo que **NO** hay que hacer

| ❌ Mal | ✅ Bien |
|---|---|
| Subir un ZIP descomprimido como rama nueva | `git clone` + branch desde `main` |
| Commitear directo a `main` | Branch + PR |
| Editar el `.env` y commitearlo | El `.env` está en `.gitignore` por algo |
| `git push --force` a `main` | Nunca, jamás |
| Commits con mensaje "auto: cambios guardados" | Mensaje que describa el cambio |
| Mergear tu propio PR sin review | Pide a alguien que lo mire |
| Renombrar/borrar archivos sin avisar al equipo | Coméntalo antes |

---

## 6. Resumen visual del flujo

```
main ─────●─────────●─────────●────────●─────  (rama protegida)
           \                             /
            \                           /
   feat/X    ●───●───●  ── PR ── merge ╯
              tu trabajo aquí
```

1. `git checkout main && git pull`
2. `git checkout -b feat/lo-que-sea`
3. Trabajas, commits pequeños
4. `git push -u origin feat/lo-que-sea`
5. PR en GitHub → review → merge
6. Borras la rama, vuelves a 1

---

## 7. Comandos chuleta

```bash
# Estado y diferencias
git status
git diff
git log --oneline -10

# Trabajar con ramas
git branch                          # ver ramas locales
git branch -a                       # ver todas (incl. remotas)
git checkout -b nombre-rama         # crear y cambiar a
git checkout main                   # cambiar a otra existente
git branch -d nombre-rama           # borrar

# Commits
git add archivo                     # stage
git add .                           # stage todo
git commit -m "msg"                 # commit
git commit --amend                  # corregir el último (NO pusheado)

# Sincronizar
git pull                            # bajar de main/upstream
git push                            # subir mi rama
git fetch                           # bajar refs sin mergear

# Emergencias
git stash                           # guardar cambios sin commitear
git stash pop                       # recuperarlos
git reset --hard HEAD               # descartar TODO lo no commiteado (cuidado)
```

---

## Dudas

Si algo no te sale, **NO subas un ZIP**. Pregunta al grupo o me llamas. Es
preferible perder 5 min preguntando que media tarde reconstruyendo un repo
desde un snapshot.
