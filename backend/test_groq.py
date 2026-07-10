import os
from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()

def test_groq():
    llm = ChatGroq(
        model="llama-3.1-8b-instant",  # or "llama3-8b-8192" for faster/cheaper
        temperature=0.3,
        max_tokens=1000
    )
    
    response = llm.invoke("What are the top 5 in-demand tech skills in Nepal right now?")
    print(response.content)

if __name__ == "__main__":
    test_groq()