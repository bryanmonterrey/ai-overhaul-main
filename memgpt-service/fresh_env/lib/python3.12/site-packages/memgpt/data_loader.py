import torch
from torch.utils.data import Dataset, DataLoader

class TextDataset(Dataset):
    def __init__(self, text, vocab, max_len):
        self.text = text
        self.vocab = vocab
        self.max_len = max_len

    def __len__(self):
        return len(self.text) - self.max_len

    def __getitem__(self, idx):
        chunk = self.text[idx:idx + self.max_len + 1]
        input_text = torch.tensor([self.vocab[char] for char in chunk[:-1]], dtype=torch.long)
        target_text = torch.tensor([self.vocab[char] for char in chunk[1:]], dtype=torch.long)
        return input_text, target_text

def get_data_loader(text, vocab, max_len, batch_size):
    dataset = TextDataset(text, vocab, max_len)
    data_loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)
    return data_loader
