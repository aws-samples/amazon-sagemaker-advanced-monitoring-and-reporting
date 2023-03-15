# Check .nvmrc for exact version
ARG VARIANT="0-18"
FROM mcr.microsoft.com/devcontainers/typescript-node:${VARIANT}

# Install OS packages
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    bash-completion \
    make

# Install Python
RUN apt-get -y install --no-install-recommends \
		python3.9 \
		python3-pip

# AWS CLI
SHELL ["/bin/zsh", "-c"]
RUN mkdir -p /tmp/download \
	&& cd /tmp/download \
	&& curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" --silent -o "awscliv2.zip" \
	&& unzip -qq awscliv2.zip \
	&& ./aws/install \
	&& rm -rf /tmp/download \
	&& autoload bashcompinit && bashcompinit \
	&& autoload -Uz compinit && compinit \
 	&& echo "complete -C '/usr/local/bin/aws_completer' aws" | tee --append /home/node/.bashrc /home/node/.zshrc

# Copy developer's AWS config
RUN mkdir /home/node/.aws
RUN chown -R node:node /home/node/.aws

# Install global node packages
RUN su node -c "npm install -g aws-cdk aws-sso-creds-helper"

RUN mkdir -p /home/node/.local/bin
COPY library/scripts/app-npm-install /home/node/.local/bin/app-npm-install
RUN chmod +x /home/node/.local/bin/app-npm-install

COPY library/scripts/app-pip-install /usr/local/bin/app-pip-install
RUN chmod +x /usr/local/bin/app-pip-install

COPY post-start.sh /usr/local/bin/post-start
RUN chmod +x /usr/local/bin/post-start
