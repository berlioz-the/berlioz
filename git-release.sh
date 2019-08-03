#!/bin/bash

MY_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
MY_DIR="$(dirname $MY_PATH)"
echo "MY_DIR: $MY_DIR"

CURR_BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
echo "Current Branch: $CURR_BRANCH_NAME"

if [[ -z $(git status -s) ]]
then
    echo "ERROR: No pending changes..."
    exit 1
fi

echo "Adding to index..."
git add -A
retval=$?
if [ $retval -ne 0 ]; then
    echo "ERROR: Failed to add to index"
    exit 4
fi

COMMIT_MESSAGE="Berlioz CLI Release."

CHANGES=$(git status -s -u)
AREA_CHANGES=$(echo $CHANGES | awk '{$1=$1};1' | cut -d' ' -f2 | awk -F "/" '{print $1}' | sort -u)
COMMIT_MESSAGE="$(printf "$COMMIT_MESSAGE\n\nModified Areas:\n$AREA_CHANGES\n\nFiles Changed:\n$CHANGES")"

echo "Committing..."
git commit -m "$COMMIT_MESSAGE"
retval=$?
if [ $retval -ne 0 ]; then
    echo "ERROR: Failed to pull the branch."
    exit 4
fi   

if [[ -z $(git status -s) ]]
then
    echo "No pending changes in $CURR_BRANCH_NAME. Good..."
else
    echo "ERROR: There are pending changes in $CURR_BRANCH_NAME. Cannot proceed."
    exit 3
fi

echo "Pulling changes from remote $CURR_BRANCH_NAME..."
git pull origin $CURR_BRANCH_NAME
retval=$?
if [ $retval -ne 0 ]; then
    echo "ERROR: Failed to pull the branch."
    exit 4
fi

# echo "Pushing change to remote $CURR_BRANCH_NAME..."
# git push origin $CURR_BRANCH_NAME
# retval=$?
# if [ $retval -ne 0 ]; then
#     echo "ERROR: Failed to push the branch."
#     exit 4
# fi

