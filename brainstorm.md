# File System

Current System:
Keeping all data and index in one key:
    Slow and redundant 

fs/ prefix: if multiple / used it is the hierarchy 
    Drawback: It depends on parsing of characters 
    Drawback: Slow for large number of files


Keep seperate index and data : Advanced
    Large blocks and block adresses 
    Index entry tells about where to find the content


