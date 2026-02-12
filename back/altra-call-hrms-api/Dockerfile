FROM php:8.2-cli-alpine

WORKDIR /app

# System deps + PHP extensions (MySQL, intl, zip)
RUN apk add --no-cache bash git unzip icu-dev libzip-dev oniguruma-dev mysql-client $PHPIZE_DEPS   && docker-php-ext-install pdo_mysql intl opcache   && pecl install redis   && docker-php-ext-enable redis   && apk del $PHPIZE_DEPS   && rm -rf /var/cache/apk/*

# Install Composer
RUN php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"   && php composer-setup.php --install-dir=/usr/local/bin --filename=composer   && rm composer-setup.php

# Copy only composer.json first (better Docker cache)
COPY composer.json ./

# Install deps without scripts (bin/console may not be needed yet during build)
RUN composer install --no-interaction --no-progress --prefer-dist --no-scripts --no-dev

# Copy the rest of the application
COPY . .

# PHP performance defaults (opcache + realpath cache)
COPY docker/php.ini /usr/local/etc/php/conf.d/zz-perf.ini

# Make entrypoint executable
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
