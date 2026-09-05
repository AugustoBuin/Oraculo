# PHP 8.3: suporte de segurança até dez/2027 e a imagem mais estável hoje.
# O código, porém, é escrito para rodar em PHP 8.1+ — sem sintaxe exclusiva de
# versões posteriores —, para que o mesmo fonte funcione em ambiente mais antigo.
FROM php:8.3-apache

# pdo_mysql é a única extensão além do que a imagem base já traz.
# Nenhuma dependência de terceiros entra aqui (docs/decisions/ADR-001).
RUN docker-php-ext-install -j"$(nproc)" pdo_mysql \
 && a2enmod rewrite headers \
 && a2dismod -f autoindex

COPY docker/app/apache.conf   /etc/apache2/sites-available/000-default.conf
COPY docker/app/php.ini       /usr/local/etc/php/conf.d/oraculo.ini
COPY docker/app/entrypoint.sh /usr/local/bin/entrypoint

RUN chmod +x /usr/local/bin/entrypoint

WORKDIR /var/www

ENTRYPOINT ["entrypoint"]
CMD ["apache2-foreground"]
