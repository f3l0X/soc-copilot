
# IA-Copilot-para-Analistas-SOC-Junior
Practica 1 del master ciberseguridad e IA
Guia puesta en marcha 
# Guia de puesta en marcha (PostgreSQL + DBeaver)

## 1) Maquina recomendada

- SO: Windows 10/11, Ubuntu 22+, macOS 13+.
- CPU: 2 nucleos minimo (4 recomendado).
- RAM: 8 GB minimo (16 GB recomendado si ademas ejecutas IA local o SIEM).
- Disco: 10 GB libres minimo (SSD recomendado).

## 2) Herramientas necesarias

- Docker Desktop (o Docker Engine + Compose).
- DBeaver Community.
- (Opcional) pgAdmin o cliente `psql`.

## 3) Levantar la base de datos

Desde la carpeta del proyecto:

```bash
docker compose up -d
```

Esto crea:

- Contenedor: `blue_team_postgres`
- Base de datos: `blue_team_db`
- Usuario: `blue_team_user`
- Password: `blue_team_pass`
- Puerto: `5432`

El archivo `postgresql_setup.sql` se ejecuta automaticamente al primer arranque del volumen.

## 4) Conexion en DBeaver

Crear conexion PostgreSQL con estos valores:

- Host: `localhost`
- Port: `5432`
- Database: `blue_team_db`
- Username: `blue_team_user`
- Password: `blue_team_pass`

Luego pulsa `Test Connection` y `Finish`.

## 5) Si cambiaste el esquema y quieres recrear todo

```bash
docker compose down -v
docker compose up -d
```

`-v` borra el volumen de datos y vuelve a ejecutar el script inicial desde cero.

## 6) Verificacion rapida

En DBeaver, ejecuta:

```sql
SELECT COUNT(*) FROM log_sources;
SELECT COUNT(*) FROM mitre_techniques;
SELECT * FROM v_open_incidents_summary;
```

Si no hay errores, la base esta operativa.

Maquina USADA: 

KALI LINUX.
  SE HA INSTALADO VARIAS HERRAMIENTAS







Para implementar la base de datos apartir del docker y con el postgres instalado, lo que hay que hacer es lo siguiente: 
Entonces solo necesitas hacer 2 cosas:

1. meter tu schema SQL dentro del contenedor PostgreSQL ya existente
2. conectar tu proyecto a esa base de datos existente

NO necesitas crear otro Docker ni otro PostgreSQL.

---

# Paso 1 — Identificar el contenedor PostgreSQL

Ver contenedores:

```bash
docker ps
```

Ejemplo:

```text
CONTAINER ID   NAMES
81ab2c1d       postgres
```

o:

```text
mi_postgres
```

Ese nombre es importante.

---

# Paso 2 — Meter el schema SQL

Si tienes:

```text
nombre de la base de datos 
```

ejecuta:

```bash
docker exec -i NOMBRE_CONTENEDOR psql -U USUARIO -d BASEDATOS < nombre de la base de datos 
```

Cambia:

* `postgres` → nombre del contenedor
* `-U postgres` → usuario real
* `-d postgres` → base de datos real

---

# Ejemplo real

Supón:

```text
contenedor: cyber-postgres
usuario: soc_user
database: soc_kb
```

Entonces:

```bash
docker exec -i cyber-postgres \
psql -U soc_user -d soc_kb < nombre de la base de datos 
```

---

# Paso 3 — Verificar tablas

Entrar:

```bash
docker exec -it NOMBRE_CONTENEDOR psql -U USUARIO -d BASEDATOS  
```

Luego:

```sql
\dt
```

Deberías ver:

```text
las tablas de la BBDD
```
---

# Paso 4 — Conectar tu proyecto

Tu proyecto ya tiene PostgreSQL funcionando.

Solo necesitas usar las credenciales correctas.

---

# En Docker Compose

El backend normalmente conecta así:

```env
DB_HOST=postgres
DB_PORT=5432
DB_NAME=soc_kb -> Nombre de la base de datos
DB_USER=soc_user -> Nombre del usuario
DB_PASSWORD=password
```

---

# Paso 5 — Probar desde el backend -> EL comando que hay que meter es el siguiente "docker exec -it NOMBRE DE LA BBDD psql -U USUARIO" para entar como superuser (ESTA MAS ABAJO EL COMANDO)
Haz una query:

```sql
SELECT * FROM kb_knowledge; -> Nombre de la tabla 
```

Si devuelve los seeds:

* brute_force_ssh
* ransomware_indicators

ya quedó integrado.

---

# Si NO sabes la base de datos

Dentro de psql:

```sql
\l
```

---

# Si NO sabes el usuario

```sql
SELECT current_user;
```

---

# Si falla por extensiones

Tu schema usa:

```sql
CREATE EXTENSION
```

Entonces quizá necesites entrar como superuser: 

```bash
docker exec -it NOMBRE DE LA BBDD psql -U USUARIO
```

y ejecutar:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

---

# Si las tablas ya existen

Puedes borrar primero:

```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

y luego volver a ejecutar el schema.

---

# Flujo final

```text
Proyecto existente
        ↓
PostgreSQL existente
        ↓
Ejecutar bloque4_schema.sql
        ↓
Tablas creadas
        ↓
Backend conectado
        ↓
Sistema funcionando
```

---

# El comando más importante

Este realmente es el núcleo de todo:

```bash
docker exec -i NOMBRE_CONTENEDOR \
psql -U USUARIO -d BASEDATOS < nombre de la base de datos 
```

Con eso implementas tu base de datos dentro del Docker ya existente.


<img width="1401" height="442" alt="image" src="https://github.com/user-attachments/assets/7b7c5bf1-9e7e-47eb-90b8-87b6271657ad" />


  
