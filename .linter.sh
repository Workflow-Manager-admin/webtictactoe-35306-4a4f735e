#!/bin/bash
cd /home/kavia/workspace/code-generation/webtictactoe-35306-4a4f735e/tic_tac_toe_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

