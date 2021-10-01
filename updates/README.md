The updates directory contains a MySQL change files. If updating from a previous version of ACE Quill do not import the ace_quill.sql, instead run the files inside this directory starting from your previous version to the latest. 

Example: 
If you are upgrading from version 0.0.0 to 1.1.0, run:
 `mysql -h <hostname> -u <user> -p ace_quill < ace_quil_changes_1.1.0.sql`

If you are upgrading from 0.0.0 to 1.1.X, run:
 `mysql -h <hostname> -u <user> -p ace_quill < ace_quil_changes_1.1.0.sql`
 `mysql -h <hostname> -u <user> -p ace_quill < ace_quil_changes_1.1.X.sql`
