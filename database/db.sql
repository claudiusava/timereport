CREATE DATABASE database_imputaciones;

USE database_imputaciones;

CREATE TABLE users(
    id int(11) NOT NULL,
    username VARCHAR(16) NOT NULL,
    password VARCHAR(16) NOT NULL
);

ALTER TABLE users 
    ADD PRIMARY KEY (id);

ALTER TABLE users
    MODIFY id INT(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT = 2;

DESCRIBE users;


-- imputaciones TABLE

CREATE TABLE imputaciones (
    id INT(11) NOT NULL,
    fecha DATE(10) NOT NULL, 
    comunidad VARCHAR (100) NOT NULL, 
    horas INT(2) NOT NULL,
    minutos INT(2) NOT NULL,
    user_id INT(11), 
    createad_at timestamp NOT NULL DEFAULT current_timestamp,
    CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

ALTER TABLE imputaciones   ADD PRIMARY KEY(id);

ALTER TABLE imputaciones
	MODIFY id INT (11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT = 2;

DESCRIBE imputaciones;