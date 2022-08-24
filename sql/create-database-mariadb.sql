-- CREATE NODEA DATABASE FOR MariaDB

DROP DATABASE IF EXISTS nodea;
CREATE DATABASE nodea
  DEFAULT CHARACTER SET utf8
  DEFAULT COLLATE utf8_general_ci;

CREATE USER IF NOT EXISTS 'nodea'@'localhost' IDENTIFIED WITH mysql_native_password BY 'nodea';
CREATE USER IF NOT EXISTS 'nodea'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY 'nodea';
CREATE USER IF NOT EXISTS 'nodea'@'%' IDENTIFIED WITH mysql_native_password BY 'nodea';
GRANT ALL PRIVILEGES ON *.* TO 'nodea'@'localhost' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON *.* TO 'nodea'@'127.0.0.1' WITH GRANT OPTION;
GRANT ALL PRIVILEGES ON *.* TO 'nodea'@'%' WITH GRANT OPTION;
FLUSH PRIVILEGES;

use nodea;
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` varchar(128) COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` mediumtext COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB